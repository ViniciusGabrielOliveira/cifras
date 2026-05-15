import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Cifra, Secao, LinhaCifra, TipoSecao } from '../../../models/cifra.model';
import { CifraService } from '../../../services/cifra.service';
import { LinhaEditorComponent } from '../../../components/linha-editor/linha-editor';
import { CifraClubImportService, CifraClubSugestao } from '../../../services/cifraclub-import.service';
import { parseCifraTexto, slugify, TONS } from '../../../core/cifra-parser';

const TIPOS: TipoSecao[] = ['intro', 'verso', 'pre-refrao', 'refrao', 'ponte', 'outro', 'solo', 'tab'];

@Component({
  selector: 'app-nova-cifra',
  standalone: true,
  imports: [CommonModule, FormsModule, LinhaEditorComponent],
  templateUrl: './nova-cifra.html',
  styleUrl: './nova-cifra.scss',
})
export class NovaCifraComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private cifraService = inject(CifraService);
  private cifraClub = inject(CifraClubImportService);

  readonly tiposSecao = TIPOS;
  readonly tons = TONS;

  cifra = signal<Cifra>({
    id:          '',
    titulo:      '',
    artista:     '',
    tom:         'C',
    instrumento: 'violao',
    dificuldade: 'basico',
    composicao:  '',
    secoes: [{
      tipo:  'verso',
      label: 'Verso 1',
      linhas: [{ letra: '', acordes: [] }],
    }],
  });

  saving   = signal(false);
  saved    = signal(false);
  showJSON = signal(false);
  colando  = signal(false);

  // ── Busca Cifra Club ─────────────────────────────────────────────
  buscaTermo       = signal('');
  sugestoes        = signal<CifraClubSugestao[]>([]);
  buscandoSugestoes = signal(false);
  buscandoImport   = signal(false);
  erroBusca        = signal<string | null>(null);
  erroImport       = signal<string | null>(null);
  importado        = signal(false);
  private _buscaTimer: ReturnType<typeof setTimeout> | null = null;

  // Validação
  erroTitulo = signal(false);

  ngOnInit() {
    // Resultado de import vindo do modal do painel — tem prioridade sobre ?nome=
    const pending = this.cifraClub.pendingImport;
    if (pending) {
      this.cifraClub.pendingImport = null;
      const secoes = parseCifraTexto(pending.lyricsWithChords);
      const tom = TONS.includes(pending.tom) ? pending.tom : 'C';
      this.cifra.set({
        id:          slugify(pending.title || ''),
        titulo:      pending.title  || '',
        artista:     pending.artist || '',
        tom,
        instrumento: 'violao',
        dificuldade: 'basico',
        composicao:  '',
        secoes,
      });
      this.importado.set(true);
      return;
    }

    const nome = this.route.snapshot.queryParamMap.get('nome') ?? '';
    if (nome) {
      this.cifra.update(c => ({
        ...c,
        titulo: nome,
        id:     slugify(nome),
      }));
    }
  }

  // ── Busca Cifra Club ─────────────────────────────────────────────

  onBuscaInput(termo: string) {
    this.buscaTermo.set(termo);
    this.sugestoes.set([]);
    this.erroBusca.set(null);
    if (this._buscaTimer) clearTimeout(this._buscaTimer);
    if (!termo.trim()) { this.buscandoSugestoes.set(false); return; }
    this.buscandoSugestoes.set(true);
    this._buscaTimer = setTimeout(() => this._executarBusca(termo), 400);
  }

  private async _executarBusca(termo: string) {
    try {
      const lista = await this.cifraClub.buscarSugestoes(termo);
      this.sugestoes.set(lista);
    } catch {
      this.erroBusca.set('Não foi possível buscar sugestões. Verifique sua conexão.');
    } finally {
      this.buscandoSugestoes.set(false);
    }
  }

  async importarSugestao(s: CifraClubSugestao) {
    this.sugestoes.set([]);
    this.buscaTermo.set('');
    this.erroImport.set(null);
    this.buscandoImport.set(true);
    try {
      const result = await this.cifraClub.importarMusica(s);
      const secoes = parseCifraTexto(result.lyricsWithChords);
      const tomValido = TONS.includes(result.tom) ? result.tom : 'C';
      this.cifra.update(c => ({
        ...c,
        titulo:    result.title   || c.titulo,
        artista:   result.artist  || c.artista,
        tom:       tomValido,
        sourceUrl: result.sourceUrl,
        id:        result.title ? slugify(result.title) : c.id,
        secoes,
      }));
      this.importado.set(true);
      this.erroTitulo.set(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.erroImport.set(msg || 'Não foi possível importar a música. Tente novamente.');
    } finally {
      this.buscandoImport.set(false);
    }
  }

  // ── Metadados ─────────────────────────────────────────────────────

  updateMeta(field: keyof Cifra, value: string) {
    this.cifra.update(c => {
      const updated: Cifra = { ...c, [field]: value };
      if (field === 'titulo') {
        updated.id = slugify(value);
      }
      return updated;
    });
    if (field === 'titulo') this.erroTitulo.set(false);
  }

  // ── Seções ────────────────────────────────────────────────────────

  addSecao() {
    const nova: Secao = { tipo: 'verso', label: 'Nova Seção', linhas: [{ letra: '', acordes: [] }] };
    this.cifra.update(c => ({ ...c, secoes: [...c.secoes, nova] }));
  }

  removeSecao(idx: number) {
    this.cifra.update(c => ({ ...c, secoes: c.secoes.filter((_: Secao, i: number) => i !== idx) }));
  }

  updateSecaoLabel(idx: number, label: string) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      secoes[idx] = { ...secoes[idx], label };
      return { ...c, secoes };
    });
  }

  updateSecaoTipo(idx: number, tipo: TipoSecao) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      const secao = secoes[idx];
      if (tipo === 'tab') {
        // Converte linhas existentes em texto bruto
        const tabText = secao.linhas.map(l => l.letra).join('\n');
        secoes[idx] = { ...secao, tipo, linhas: [], tabText };
      } else if (secao.tipo === 'tab') {
        // Converte o texto bruto de volta para linhas simples
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
      const secoes = [...c.secoes];
      secoes[idx] = { ...secoes[idx], tabText };
      return { ...c, secoes };
    });
  }

  // ── Linhas ────────────────────────────────────────────────────────

  addLinha(secaoIdx: number) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      secoes[secaoIdx] = {
        ...secoes[secaoIdx],
        linhas: [...secoes[secaoIdx].linhas, { letra: '', acordes: [] }],
      };
      return { ...c, secoes };
    });
  }

  removeLinha(secaoIdx: number, linhaIdx: number) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      const linhas = secoes[secaoIdx].linhas.filter((_: LinhaCifra, i: number) => i !== linhaIdx);
      secoes[secaoIdx] = { ...secoes[secaoIdx], linhas };
      return { ...c, secoes };
    });
  }

  updateLinha(secaoIdx: number, linhaIdx: number, linha: LinhaCifra) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      const linhas = [...secoes[secaoIdx].linhas];
      linhas[linhaIdx] = linha;
      secoes[secaoIdx] = { ...secoes[secaoIdx], linhas };
      return { ...c, secoes };
    });
  }

  // ── Salvar ────────────────────────────────────────────────────────

  salvar() {
    const cifra = this.cifra();
    if (!cifra.titulo.trim()) {
      this.erroTitulo.set(true);
      return;
    }
    this.saving.set(true);
    this.cifraService.salvarCifra(cifra).subscribe(() => {
      this.saving.set(false);
      this.saved.set(true);
      setTimeout(() => this.router.navigate(['/admin/painel'], {
        queryParams: { cifraAdicionada: cifra.id, nomeCifra: cifra.titulo },
      }), 800);
    });
  }

  async colarMusica() {
    try {
      this.colando.set(true);
      const texto = await navigator.clipboard.readText();
      const secoes = parseCifraTexto(texto);
      this.cifra.update(c => ({ ...c, secoes }));
    } catch { /* permissão negada ou clipboard vazio */ }
    finally { this.colando.set(false); }
  }

  cancelar() {
    if (confirm('Descartar a nova música?')) {
      this.router.navigate(['/admin/painel'], {
        queryParams: { restaurarRascunho: 'true' },
      });
    }
  }

  get jsonPreview(): string {
    return JSON.stringify(this.cifra(), null, 2);
  }

  get idGerado(): string {
    return this.cifra().id || '(preencha o título)';
  }
}
