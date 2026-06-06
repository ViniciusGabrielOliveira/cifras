import { Component, inject, signal, computed, OnInit, DestroyRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Cifra } from '../../../models/cifra.model';
import { CifraPrModalComponent, FluxoPR, ResultadoPRModal } from '../../../components/cifra-pr-modal/cifra-pr-modal';
import { CifraMetadataFormComponent } from '../../../components/cifra-metadata-form/cifra-metadata-form';
import { SecoesCifraEditorComponent } from '../../../components/secoes-cifra-editor/secoes-cifra-editor';
import { CifraService } from '../../../services/cifra.service';
import { AcordesService } from '../../../services/acordes.service';
import { AuthService } from '../../../services/auth.service';
import { CifraClubImportService } from '../../../services/cifraclub-import.service';
import { parseCifraTexto, slugify, TONS } from '../../../core/cifra-parser';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';

const CIFRA_VAZIA: Cifra = {
  id: '', titulo: '', artista: '', tom: 'C',
  instrumento: 'violao', dificuldade: 'basico', composicao: '',
  categorias: [], partesMissa: [],
  secoes: [{ tipo: 'verso', label: 'Verso 1', linhas: [{ letra: '', acordes: [] }] }],
};

@Component({
  selector: 'app-cifra-editor',
  standalone: true,
  imports: [CifraPrModalComponent, CifraMetadataFormComponent, SecoesCifraEditorComponent],
  templateUrl: './cifra-editor.html',
  styleUrl: './cifra-editor.scss',
})
export class CifraEditorComponent implements OnInit {
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private cifraService = inject(CifraService);
  private acordesService = inject(AcordesService);
  private auth         = inject(AuthService);
  private cifraClub    = inject(CifraClubImportService);
  private destroyRef   = inject(DestroyRef);
  readonly notif       = inject(NotificationService);
  private confirmDialog = inject(ConfirmDialogService);

  @ViewChild(SecoesCifraEditorComponent) secoesEditor!: SecoesCifraEditorComponent;

  readonly userMode   = computed(() => !!this.route.snapshot.data['userMode']);
  readonly modoEditar = computed(() => !!this.route.snapshot.paramMap.get('id'));

  cifra       = signal<Cifra | null>(null);
  loading     = signal(false);
  notFound    = signal(false);
  saving      = signal(false);
  saved       = signal(false);
  erroTitulo  = signal(false);

  modalPRAberto    = signal(false);
  modalPRFluxo     = signal<FluxoPR>('nova_cifra');
  modalPRSubmitting = signal(false);
  private _cifraParaPR: Cifra | null = null;

  private _salvouNestaSessao = false;
  private _oldCifraId: string | null = null;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.loading.set(true);
      this.cifraService.getCifra(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(c => {
          if (c) {
            this.cifra.set(JSON.parse(JSON.stringify(c)));
          } else {
            this.notFound.set(true);
            setTimeout(() => this.voltar(), 3000);
          }
          this.loading.set(false);
        });
    } else {
      const pending = this.cifraClub.pendingImport;
      if (pending) {
        this.cifraClub.pendingImport = null;
        const tom = TONS.includes(pending.tom) ? pending.tom : 'C';
        this.cifra.set({
          ...CIFRA_VAZIA,
          id:      slugify(pending.title || ''),
          titulo:  pending.title  || '',
          artista: pending.artist || '',
          tom,
          secoes: parseCifraTexto(pending.lyricsWithChords),
        });
        return;
      }
      const nome = this.route.snapshot.queryParamMap.get('nome') ?? '';
      this.cifra.set({ ...CIFRA_VAZIA, titulo: nome, id: slugify(nome) });
    }
  }

  async voltar() {
    if (!this.modoEditar() && !await this.confirmDialog.confirmar('Descartar a nova música?')) return;

    if (this.userMode()) {
      const retornoLista = this.route.snapshot.queryParamMap.get('retornoLista');
      if (retornoLista) {
        const queryParams: Record<string, string> = {};
        if (this.modoEditar() && this._oldCifraId && this.cifra()?.id !== this._oldCifraId) {
          queryParams['replaceCifraId'] = this._oldCifraId;
          queryParams['newCifraId']     = this.cifra()!.id;
        }
        this.router.navigate(['/minha-area/lista', retornoLista], {
          queryParams: Object.keys(queryParams).length ? queryParams : undefined,
        });
      } else {
        this.router.navigate(['/minha-area']);
      }
      return;
    }

    if (!this.modoEditar()) {
      this.router.navigate(['/admin/painel'], { queryParams: { restaurarRascunho: 'true' } });
      return;
    }

    const retorno = this.route.snapshot.queryParamMap.get('retorno');
    if (retorno === 'painel') {
      const c = this.cifra();
      const queryParams: Record<string, string> = { restaurarRascunho: 'true' };
      if (this._salvouNestaSessao && c) {
        queryParams['nomeCifra']     = c.titulo;
        queryParams['cifraAdicionada'] = c.id;
        queryParams['edicaoCifra']   = 'true';
      }
      this.router.navigate(['/admin/painel'], { queryParams });
    } else {
      const c = this.cifra();
      if (c) this.router.navigate(['/cifra', c.id]);
      else this.router.navigate(['/admin/painel']);
    }
  }

  onCifraMetadataChange(updated: Cifra) {
    this.cifra.set(updated);
    if (this.erroTitulo()) this.erroTitulo.set(false);
  }

  salvar() {
    const c = this.cifra();
    if (!c) return;

    if (!this.modoEditar() && !c.titulo.trim()) {
      this.erroTitulo.set(true);
      return;
    }

    const secoes = this.secoesEditor?.getSecoesAtuais() ?? c.secoes;
    const cifraFinal = { ...c, secoes };

    const uid     = this.auth.user()?.uid ?? '';
    const isAdmin = this.auth.hasRole('admin');

    if (this.userMode() && !isAdmin) {
      if (!this.modoEditar()) {
        this._cifraParaPR = { ...cifraFinal, donoUid: uid };
        this.modalPRFluxo.set('nova_cifra');
        this.modalPRAberto.set(true);
        return;
      }

      if (cifraFinal.status === 'publica') {
        this._cifraParaPR = cifraFinal;
        this.modalPRFluxo.set('nova_versao');
        this.modalPRAberto.set(true);
        return;
      }

      if (cifraFinal.status !== 'privada' || cifraFinal.donoUid !== uid) {
        this.cifraService.countCifrasDoUser(uid)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(count => {
          if (count >= 25) {
            this.notif.mostrarErro('Limite de 25 músicas editadas atingido. Remova uma antes de editar outra.');
            return;
          }
          this._oldCifraId = cifraFinal.id;
          const novoId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
          const privada = { ...cifraFinal, id: novoId, status: 'privada' as const, donoUid: uid };
          this.cifra.set(privada);
          this._executarSalvar(privada);
        });
        return;
      }
    }

    this._executarSalvar(cifraFinal);
  }

  onResultadoPRModal(resultado: ResultadoPRModal) {
    this.modalPRAberto.set(false);
    const c = this._cifraParaPR;
    if (!c) return;

    if (resultado.acao === 'cancelar') return;

    if (resultado.acao === 'salvar_privada') {
      const uid = this.auth.user()?.uid ?? '';
      const privada = { ...c, status: 'privada' as const, donoUid: uid };
      this.cifra.set(privada);
      this._executarSalvar(privada);
      return;
    }

    const uid      = this.auth.user()?.uid ?? '';
    const userName = this.auth.user()?.displayName ?? uid;
    const cifraId  = this.modalPRFluxo() === 'nova_versao' ? c.id : null;
    const { id: _id, listasIds: _l, ...dadosCifra } = c as any;

    this.modalPRSubmitting.set(true);
    this.cifraService.submeterPR(
      dadosCifra, cifraId, uid, userName, resultado.motivo, resultado.motivoCustom,
    ).subscribe({
      next: () => {
        this.modalPRSubmitting.set(false);
        this._cifraParaPR = null;
        this.saved.set(true);
        setTimeout(() => {
          const retornoLista = this.route.snapshot.queryParamMap.get('retornoLista');
          if (retornoLista) this.router.navigate(['/minha-area/lista', retornoLista]);
          else this.router.navigate(['/minha-area']);
        }, 800);
      },
      error: (err: Error) => {
        this.modalPRSubmitting.set(false);
        this.notif.mostrarErro(err.message || 'Erro ao enviar solicitação.');
      },
    });
  }

  private _executarSalvar(cifraParaSalvar: Cifra) {
    this.saving.set(true);
    this.cifraService.salvarCifra(cifraParaSalvar).subscribe({
      next: () => {
        this.acordesService.syncAcordes(cifraParaSalvar);
        this.saving.set(false);
        this.saved.set(true);

        if (this.modoEditar()) {
          this._salvouNestaSessao = true;
          setTimeout(() => this.saved.set(false), 2500);
        } else if (this.userMode()) {
          const retornoLista = this.route.snapshot.queryParamMap.get('retornoLista');
          const parte        = this.route.snapshot.queryParamMap.get('parte') ?? 'entrada';
          setTimeout(() => {
            if (retornoLista) {
              this.router.navigate(['/minha-area/lista', retornoLista], {
                queryParams: { cifraAdicionada: cifraParaSalvar.id, nomeCifra: cifraParaSalvar.titulo, parte },
              });
            } else {
              this.router.navigate(['/minha-area']);
            }
          }, 800);
        } else {
          setTimeout(() => this.router.navigate(['/admin/painel'], {
            queryParams: { cifraAdicionada: cifraParaSalvar.id, nomeCifra: cifraParaSalvar.titulo },
          }), 800);
        }
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.notif.mostrarErro(err.message || 'Erro ao salvar. Tente novamente.');
      },
    });
  }

  async resetarOriginal() {
    const c = this.cifra();
    if (!c) return;
    if (!await this.confirmDialog.confirmar('Descartar todas as edições e recarregar do servidor?')) return;
    this.cifraService.getCifra(c.id).subscribe(original => {
      if (original) {
        const deep = JSON.parse(JSON.stringify(original));
        this.cifra.set(deep);
        this.secoesEditor?.reset(deep.secoes);
      }
    });
  }
}
