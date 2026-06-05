import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Cifra, LinhaCifra, Secao, TipoSecao, MotivoVersao } from '../../../models/cifra.model';
import { LinhaEditorComponent } from '../../../components/linha-editor/linha-editor';
import { AppSelectComponent } from '../../../components/app-select/app-select';
import { CifraPrModalComponent, FluxoPR, ResultadoPRModal } from '../../../components/cifra-pr-modal/cifra-pr-modal';
import { CifraService } from '../../../services/cifra.service';
import { AcordesService } from '../../../services/acordes.service';
import { ConfigService } from '../../../services/config.service';
import { AuthService } from '../../../services/auth.service';
import { CifraClubImportService } from '../../../services/cifraclub-import.service';
import { parseCifraTexto, cifraToTexto, slugify, TONS } from '../../../core/cifra-parser';

const TIPOS: TipoSecao[] = ['intro', 'verso', 'pre-refrao', 'refrao', 'ponte', 'outro', 'solo', 'tab'];

const CIFRA_VAZIA: Cifra = {
  id: '', titulo: '', artista: '', tom: 'C',
  instrumento: 'violao', dificuldade: 'basico', composicao: '',
  categorias: [], partesMissa: [],
  secoes: [{ tipo: 'verso', label: 'Verso 1', linhas: [{ letra: '', acordes: [] }] }],
};

@Component({
  selector: 'app-cifra-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, LinhaEditorComponent, AppSelectComponent, CifraPrModalComponent],
  templateUrl: './cifra-editor.html',
  styleUrl: './cifra-editor.scss',
})
export class CifraEditorComponent implements OnInit {
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private cifraService = inject(CifraService);
  private acordesService = inject(AcordesService);
  private config       = inject(ConfigService);
  private auth         = inject(AuthService);
  private cifraClub    = inject(CifraClubImportService);
  private destroyRef   = inject(DestroyRef);

  // ─── Modo ────────────────────────────────────────────────────────────────────

  readonly userMode   = computed(() => !!this.route.snapshot.data['userMode']);
  readonly modoEditar = computed(() => !!this.route.snapshot.paramMap.get('id'));

  // ─── Estado ──────────────────────────────────────────────────────────────────

  cifra       = signal<Cifra | null>(null);
  loading     = signal(false);
  notFound    = signal(false);
  saving      = signal(false);
  saved       = signal(false);
  erroTitulo  = signal(false);
  erroSalvar  = signal<string | null>(null);
  modoTexto   = signal(false);
  textoEditor = signal('');

  // ── Modal PR ─────────────────────────────────────────────────────
  modalPRAberto    = signal(false);
  modalPRFluxo     = signal<FluxoPR>('nova_cifra');
  modalPRSubmitting = signal(false);
  private _cifraParaPR: Cifra | null = null;

  private _salvouNestaSessao = false;
  private _oldCifraId: string | null = null;

  // ─── Opções ──────────────────────────────────────────────────────────────────

  readonly categorias        = this.config.categorias;
  readonly partesMissa       = this.config.partesMissa;
  readonly tonsOptions       = TONS;
  readonly tiposSecaoOptions = TIPOS;
  readonly instrumentoOptions = [
    { value: 'violao',   label: 'Violão' },
    { value: 'guitarra', label: 'Guitarra' },
    { value: 'cavaco',   label: 'Cavaquinho' },
    { value: 'ukulele',  label: 'Ukulele' },
  ];
  readonly dificuldadeOptions = [
    { value: 'iniciante',    label: 'Iniciante' },
    { value: 'basico',       label: 'Básico' },
    { value: 'intermediario', label: 'Intermediário' },
    { value: 'avancado',     label: 'Avançado' },
  ];

  get idGerado(): string {
    return this.cifra()?.id || '(preencha o título)';
  }

  // ─── Inicialização ───────────────────────────────────────────────────────────

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      // Modo editar: carrega do servidor
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
      // Modo criar: verifica import pendente do CifraClub
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

  // ─── Navegação ───────────────────────────────────────────────────────────────

  voltar() {
    if (!this.modoEditar() && !confirm('Descartar a nova música?')) return;

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

  // ─── Metadados ───────────────────────────────────────────────────────────────

  updateMeta(field: keyof Cifra, value: string) {
    this.cifra.update(c => {
      if (!c) return c;
      const updated = { ...c, [field]: value };
      if (field === 'titulo' && !this.modoEditar()) updated.id = slugify(value);
      return updated;
    });
    if (field === 'titulo') this.erroTitulo.set(false);
  }

  toggleCategoria(id: string) {
    this.cifra.update(c => {
      if (!c) return c;
      const cats = c.categorias ?? [];
      return { ...c, categorias: cats.includes(id) ? cats.filter(x => x !== id) : [...cats, id] };
    });
  }

  toggleParte(id: string) {
    this.cifra.update(c => {
      if (!c) return c;
      const partes = c.partesMissa ?? [];
      return { ...c, partesMissa: partes.includes(id) ? partes.filter(x => x !== id) : [...partes, id] };
    });
  }

  // ─── Seções ──────────────────────────────────────────────────────────────────

  addSecao() {
    const nova: Secao = { tipo: 'verso', label: 'Nova Seção', linhas: [{ letra: '', acordes: [] }] };
    this.cifra.update(c => c ? { ...c, secoes: [...c.secoes, nova] } : c);
  }

  removeSecao(idx: number) {
    this.cifra.update(c => c ? { ...c, secoes: c.secoes.filter((_, i) => i !== idx) } : c);
  }

  updateSecaoLabel(idx: number, label: string) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      secoes[idx] = { ...secoes[idx], label };
      return { ...c, secoes };
    });
  }

  onSecaoTipoChange(idx: number, value: string) {
    this.updateSecaoTipo(idx, value as TipoSecao);
  }

  updateSecaoTipo(idx: number, tipo: TipoSecao) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      const secao  = secoes[idx];
      if (tipo === 'tab') {
        secoes[idx] = { ...secao, tipo, linhas: [], tabText: secao.linhas.map(l => l.letra).join('\n') };
      } else if (secao.tipo === 'tab') {
        secoes[idx] = { ...secao, tipo, linhas: (secao.tabText ?? '').split('\n').map(l => ({ letra: l, acordes: [] })), tabText: undefined };
      } else {
        secoes[idx] = { ...secao, tipo };
      }
      return { ...c, secoes };
    });
  }

  updateTabText(idx: number, tabText: string) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      secoes[idx] = { ...secoes[idx], tabText };
      return { ...c, secoes };
    });
  }

  // ─── Linhas ──────────────────────────────────────────────────────────────────

  addLinha(secaoIdx: number) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      secoes[secaoIdx] = { ...secoes[secaoIdx], linhas: [...secoes[secaoIdx].linhas, { letra: '', acordes: [] }] };
      return { ...c, secoes };
    });
  }

  removeLinha(secaoIdx: number, linhaIdx: number) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      secoes[secaoIdx] = { ...secoes[secaoIdx], linhas: secoes[secaoIdx].linhas.filter((_, i) => i !== linhaIdx) };
      return { ...c, secoes };
    });
  }

  updateLinha(secaoIdx: number, linhaIdx: number, linha: LinhaCifra) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      const linhas = [...secoes[secaoIdx].linhas];
      linhas[linhaIdx] = linha;
      secoes[secaoIdx] = { ...secoes[secaoIdx], linhas };
      return { ...c, secoes };
    });
  }

  // ─── Salvar ──────────────────────────────────────────────────────────────────

  salvar() {
    if (this.modoTexto()) {
      const texto = this.textoEditor();
      if (texto.trim()) {
        this.cifra.update(c => c ? { ...c, secoes: parseCifraTexto(texto) } : c);
      }
    }

    const c = this.cifra();
    if (!c) return;

    if (!this.modoEditar() && !c.titulo.trim()) {
      this.erroTitulo.set(true);
      return;
    }

    const uid     = this.auth.user()?.uid ?? '';
    const isAdmin = this.auth.hasRole('admin');

    if (this.userMode() && !isAdmin) {
      if (!this.modoEditar()) {
        // Nova cifra: pergunta se quer submeter como pública
        this._cifraParaPR = { ...c, donoUid: uid };
        this.modalPRFluxo.set('nova_cifra');
        this.modalPRAberto.set(true);
        return;
      }

      if (c.status === 'publica') {
        // Editando cifra pública: abre fluxo de nova versão
        this._cifraParaPR = c;
        this.modalPRFluxo.set('nova_versao');
        this.modalPRAberto.set(true);
        return;
      }

      if (c.status !== 'privada' || c.donoUid !== uid) {
        // Editando cifra de outro: cria cópia privada (comportamento legado)
        this.cifraService.countCifrasDoUser(uid)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(count => {
          if (count >= 25) {
            this.erroSalvar.set('Limite de 25 músicas editadas atingido. Remova uma antes de editar outra.');
            setTimeout(() => this.erroSalvar.set(null), 5000);
            return;
          }
          this._oldCifraId = c.id;
          const novoId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
          const privada = { ...c, id: novoId, status: 'privada' as const, donoUid: uid };
          this.cifra.set(privada);
          this._executarSalvar(privada);
        });
        return;
      }
    }

    this._executarSalvar(c);
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

    // submeter_pr
    const uid      = this.auth.user()?.uid ?? '';
    const userName = this.auth.user()?.displayName ?? uid;
    const cifraId  = this.modalPRFluxo() === 'nova_versao' ? c.id : null;
    const { id: _id, listasIds: _l, ...dadosCifra } = c as any;

    this.modalPRSubmitting.set(true);
    this.cifraService.submeterPR(
      dadosCifra,
      cifraId,
      uid,
      userName,
      resultado.motivo,
      resultado.motivoCustom,
    ).subscribe({
      next: () => {
        this.modalPRSubmitting.set(false);
        this._cifraParaPR = null;
        this.saved.set(true);
        setTimeout(() => {
          const retornoLista = this.route.snapshot.queryParamMap.get('retornoLista');
          if (retornoLista) {
            this.router.navigate(['/minha-area/lista', retornoLista]);
          } else {
            this.router.navigate(['/minha-area']);
          }
        }, 800);
      },
      error: (err: Error) => {
        this.modalPRSubmitting.set(false);
        this.erroSalvar.set(err.message || 'Erro ao enviar solicitação.');
        setTimeout(() => this.erroSalvar.set(null), 5000);
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
        this.erroSalvar.set(err.message || 'Erro ao salvar. Tente novamente.');
        setTimeout(() => this.erroSalvar.set(null), 5000);
      },
    });
  }

  resetarOriginal() {
    const c = this.cifra();
    if (!c) return;
    if (!confirm('Descartar todas as edições e recarregar do servidor?')) return;
    this.cifraService.getCifra(c.id).subscribe(original => {
      if (original) this.cifra.set(JSON.parse(JSON.stringify(original)));
    });
  }

  // ─── Modo texto / visual ─────────────────────────────────────────────────────

  entrarModoTexto() {
    const c = this.cifra();
    if (c) this.textoEditor.set(cifraToTexto(c.secoes));
    this.modoTexto.set(true);
  }

  entrarModoVisual() {
    const texto = this.textoEditor();
    if (texto.trim()) {
      this.cifra.update(c => c ? { ...c, secoes: parseCifraTexto(texto) } : c);
    }
    this.modoTexto.set(false);
  }

  // ─── Seleção / Copiar / Colar ────────────────────────────────────────────────

  selecionadas = signal<Set<string>>(new Set());
  clipboard    = signal<LinhaCifra[] | null>(null);
  temSelecao   = computed(() => this.selecionadas().size > 0);

  linhaKey(si: number, li: number) { return `${si}-${li}`; }

  isSelected(si: number, li: number) {
    return this.selecionadas().has(this.linhaKey(si, li));
  }

  toggleSelecao(si: number, li: number) {
    this.selecionadas.update(s => {
      const n = new Set(s);
      const k = this.linhaKey(si, li);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  limparSelecao() { this.selecionadas.set(new Set()); }

  private _linhasSelecionadas(): LinhaCifra[] {
    const c = this.cifra();
    if (!c) return [];
    const keys = this.selecionadas();
    const out: LinhaCifra[] = [];
    c.secoes.forEach((s, si) => s.linhas.forEach((l, li) => {
      if (keys.has(this.linhaKey(si, li))) out.push(JSON.parse(JSON.stringify(l)));
    }));
    return out;
  }

  copiarSelecionadas() {
    this.clipboard.set(this._linhasSelecionadas());
    this.selecionadas.set(new Set());
  }

  recortarSelecionadas() {
    this.clipboard.set(this._linhasSelecionadas());
    const keys = this.selecionadas();
    this.cifra.update(c => {
      if (!c) return c;
      return { ...c, secoes: c.secoes.map((s, si) => ({
        ...s, linhas: s.linhas.filter((_, li) => !keys.has(this.linhaKey(si, li))),
      }))};
    });
    this.selecionadas.set(new Set());
  }

  colarEm(si: number, li: number) {
    const linhas = this.clipboard();
    if (!linhas?.length) return;
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      const novas  = [...secoes[si].linhas];
      novas.splice(li, 0, ...linhas.map(l => JSON.parse(JSON.stringify(l))));
      secoes[si] = { ...secoes[si], linhas: novas };
      return { ...c, secoes };
    });
  }

  // ─── Drag & Drop de linhas ───────────────────────────────────────────────────

  onLinhasDrop(event: CdkDragDrop<number>) {
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;
    const fromSi = event.previousContainer.data;
    const toSi   = event.container.data;
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = c.secoes.map(s => ({ ...s, linhas: [...s.linhas] }));
      const [linha] = secoes[fromSi].linhas.splice(event.previousIndex, 1);
      secoes[toSi].linhas.splice(event.currentIndex, 0, linha);
      return { ...c, secoes };
    });
    this.selecionadas.set(new Set());
  }
}
