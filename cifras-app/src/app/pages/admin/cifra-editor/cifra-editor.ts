import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Cifra, LinhaCifra, Secao, TipoSecao } from '../../../models/cifra.model';
import { LinhaEditorComponent } from '../../../components/linha-editor/linha-editor';
import { AppSelectComponent } from '../../../components/app-select/app-select';
import { CifraService } from '../../../services/cifra.service';
import { AcordesService } from '../../../services/acordes.service';
import { ConfigService } from '../../../services/config.service';
import { AuthService } from '../../../services/auth.service';
import { TONS } from '../../../core/cifra-parser';

const TIPOS: TipoSecao[] = ['intro', 'verso', 'pre-refrao', 'refrao', 'ponte', 'outro', 'solo', 'tab'];

@Component({
  selector: 'app-cifra-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, LinhaEditorComponent, AppSelectComponent],
  templateUrl: './cifra-editor.html',
  styleUrl: './cifra-editor.scss',
})
export class CifraEditorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cifraService = inject(CifraService);
  private acordesService = inject(AcordesService);
  private config = inject(ConfigService);
  private auth = inject(AuthService);

  readonly userMode = computed(() => !!this.route.snapshot.data['userMode']);

  readonly categorias = this.config.categorias;
  readonly partesMissa = this.config.partesMissa;

  cifra = signal<Cifra | null>(null);
  loading = signal(true);
  notFound = signal(false);
  saving = signal(false);
  saved = signal(false);
  erroSalvar = signal<string | null>(null);
  private _salvouNestaSessao = false;
  private _oldCifraId: string | null = null;

  readonly tiposSecao = TIPOS;
  readonly tonsOptions = TONS;
  readonly tiposSecaoOptions = TIPOS;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!id) { this.voltar(); return; }
    this.cifraService.getCifra(id).subscribe(c => {
      if (c) {
        this.cifra.set(JSON.parse(JSON.stringify(c)));
      } else {
        this.notFound.set(true);
        setTimeout(() => this.voltar(), 3000);
      }
      this.loading.set(false);
    });
  }

  voltar() {
    if (this.userMode()) {
      const retornoLista = this.route.snapshot.queryParamMap.get('retornoLista');
      if (retornoLista) {
        const queryParams: Record<string, string> = {};
        if (this._oldCifraId && this.cifra()?.id !== this._oldCifraId) {
          queryParams['replaceCifraId'] = this._oldCifraId;
          queryParams['newCifraId'] = this.cifra()!.id;
        }
        this.router.navigate(['/minha-area/lista', retornoLista], {
          queryParams: Object.keys(queryParams).length ? queryParams : undefined,
        });
      } else {
        this.router.navigate(['/minha-area']);
      }
      return;
    }
    const retorno = this.route.snapshot.queryParamMap.get('retorno');
    if (retorno === 'painel') {
      const c = this.cifra();
      const queryParams: Record<string, string> = { restaurarRascunho: 'true' };
      if (this._salvouNestaSessao && c) {
        queryParams['nomeCifra'] = c.titulo;
        queryParams['cifraAdicionada'] = c.id;
        queryParams['edicaoCifra'] = 'true';
      }
      this.router.navigate(['/admin/painel'], { queryParams });
    } else {
      const c = this.cifra();
      if (c) this.router.navigate(['/cifra', c.id]);
      else this.router.navigate(['/admin/painel']);
    }
  }

  // ─── Seções ─────────────────────────────────────────────────────────────────

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
      const secao = secoes[idx];
      if (tipo === 'tab') {
        const tabText = secao.linhas.map(l => l.letra).join('\n');
        secoes[idx] = { ...secao, tipo, linhas: [], tabText };
      } else if (secao.tipo === 'tab') {
        const linhas = (secao.tabText ?? '').split('\n').map(l => ({ letra: l, acordes: [] }));
        secoes[idx] = { ...secao, tipo, linhas, tabText: undefined };
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

  // ─── Linhas ─────────────────────────────────────────────────────────────────

  addLinha(secaoIdx: number) {
    const novaLinha: LinhaCifra = { letra: '', acordes: [] };
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      secoes[secaoIdx] = {
        ...secoes[secaoIdx],
        linhas: [...secoes[secaoIdx].linhas, novaLinha],
      };
      return { ...c, secoes };
    });
  }

  removeLinha(secaoIdx: number, linhaIdx: number) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      const linhas = secoes[secaoIdx].linhas.filter((_, i) => i !== linhaIdx);
      secoes[secaoIdx] = { ...secoes[secaoIdx], linhas };
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

  // ─── Metadados ──────────────────────────────────────────────────────────────

  updateMeta(field: keyof Cifra, value: string) {
    this.cifra.update(c => c ? { ...c, [field]: value } : c);
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

  // ─── Salvar ─────────────────────────────────────────────────────────────────

  salvar() {
    const c = this.cifra();
    if (!c) return;
    const uid = this.auth.user()?.uid ?? '';

    let cifraParaSalvar = c;
    if (this.userMode() && (c.status !== 'privada' || c.donoUid !== uid)) {
      // Cria cópia privada com novo ID para não sobrescrever a música pública
      this._oldCifraId = c.id;
      const novoId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      cifraParaSalvar = { ...c, id: novoId, status: 'privada', donoUid: uid };
      this.cifra.set(cifraParaSalvar);
    }

    this.saving.set(true);
    this.cifraService.salvarCifra(cifraParaSalvar).subscribe({
      next: () => {
        this.acordesService.syncAcordes(cifraParaSalvar);
        this.saving.set(false);
        this.saved.set(true);
        this._salvouNestaSessao = true;
        setTimeout(() => this.saved.set(false), 2500);
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

  voltarParaVisualizacao() {
    this.voltar();
  }
}
