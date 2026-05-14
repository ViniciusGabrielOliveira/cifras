import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Cifra, Secao, LinhaCifra, AcordeLinha, TipoSecao } from '../../../models/cifra.model';
import { CifraService } from '../../../services/cifra.service';
import { LinhaEditorComponent } from '../../../components/linha-editor/linha-editor';
import { REGEX_ACORDE } from '../../../core/transposicao';
import { CifraClubImportService, CifraClubSugestao } from '../../../services/cifraclub-import.service';

const TIPOS: TipoSecao[] = ['intro', 'verso', 'pre-refrao', 'refrao', 'ponte', 'outro', 'solo'];
const TONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
              'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];

function extrairAcordesLinha(linha: string): string | null {
  // Remove parênteses externos: ( C9 Am7 ) → C9 Am7
  const stripped = linha.trim().replace(/^\((.+)\)$/, '$1').trim();
  const tokens = stripped.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length > 0 && tokens.every(t => REGEX_ACORDE.test(t))) return stripped;
  return null;
}

function inferirTipo(nome: string): TipoSecao {
  const n = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/pre[\s-]?refr|pre[\s-]?chorus/.test(n)) return 'pre-refrao';
  if (/refr|coro|chorus/.test(n)) return 'refrao';
  if (/verso|verse|estrofe/.test(n)) return 'verso';
  if (/\bponte\b|bridge/.test(n)) return 'ponte';
  if (/\bintro\b/.test(n)) return 'intro';
  if (/\bsolo\b/.test(n)) return 'solo';
  return 'outro';
}

function parseLinhaCifra(letra: string, acordesLinha: string): LinhaCifra {
  const acordes: AcordeLinha[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(acordesLinha)) !== null) {
    if (REGEX_ACORDE.test(match[0])) {
      acordes.push({ acorde: match[0], posicao: match.index });
    }
  }
  const seen = new Set<number>();
  return { letra, acordes: acordes.filter(a => !seen.has(a.posicao) && seen.add(a.posicao)) };
}

function parseCifraTexto(texto: string): Secao[] {
  const secoes: Secao[] = [];
  let secaoAtual: Secao = { tipo: 'verso', label: 'Verso 1', linhas: [] };
  let acordesPendentes: string | null = null;

  const flushAcordes = () => {
    if (acordesPendentes !== null) {
      secaoAtual.linhas.push(parseLinhaCifra('', acordesPendentes));
      acordesPendentes = null;
    }
  };

  for (const linha of texto.split('\n')) {
    // [Nome] ou [Nome] C9 Am7 ...
    const secaoMatch = linha.trim().match(/^\[(.+?)\]\s*(.*)/);
    if (secaoMatch) {
      flushAcordes();
      if (secaoAtual.linhas.length > 0) secoes.push(secaoAtual);
      const nome = secaoMatch[1].trim();
      secaoAtual = { tipo: inferirTipo(nome), label: nome, linhas: [] };
      const resto = secaoMatch[2].trim();
      if (resto) {
        const acordes = extrairAcordesLinha(resto);
        if (acordes) acordesPendentes = acordes;
      }
      continue;
    }

    if (!linha.trim()) { flushAcordes(); continue; }

    const acordesLinha = extrairAcordesLinha(linha);
    if (acordesLinha !== null) {
      flushAcordes();
      acordesPendentes = acordesLinha;
      continue;
    }

    const letra = linha.trimEnd();
    if (acordesPendentes !== null) {
      secaoAtual.linhas.push(parseLinhaCifra(letra, acordesPendentes));
      acordesPendentes = null;
    } else {
      secaoAtual.linhas.push({ letra, acordes: [] });
    }
  }

  flushAcordes();
  if (secaoAtual.linhas.length > 0) secoes.push(secaoAtual);
  return secoes.length > 0
    ? secoes
    : [{ tipo: 'verso', label: 'Verso 1', linhas: [{ letra: '', acordes: [] }] }];
}

/** Transforma um título em um slug válido para ID */
function slugify(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

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
    // Pré-preenche o título se veio via query param
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
      // Atualiza o ID automaticamente se o título mudar (enquanto não salvo)
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
      secoes[idx] = { ...secoes[idx], tipo };
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
      // Volta para o painel após salvar
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
      this.router.navigate(['/admin/painel']);
    }
  }

  get jsonPreview(): string {
    return JSON.stringify(this.cifra(), null, 2);
  }

  get idGerado(): string {
    return this.cifra().id || '(preencha o título)';
  }
}
