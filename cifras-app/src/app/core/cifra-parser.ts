import { Secao, LinhaCifra, AcordeLinha, TipoSecao } from '../models/cifra.model';
import { REGEX_ACORDE } from './transposicao';

export const TONS = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',

  'Cm',
  'C#m',
  'Dm',
  'Ebm',
  'Em',
  'Fm',
  'F#m',
  'Gm',
  'G#m',
  'Am',
  'Bbm',
  'Bm',
];

export function slugify(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isTabLine(linha: string): boolean {
  return /^[EBGDAe]\|/.test(linha.trim());
}

const HAS_PARENS_ARROWS = /[()]|-+>|[→➜⟶🡪]/;

function extrairAcordesLinha(linha: string): string | null {
  // Remove parênteses (ex: "D9 ( D4 D )") e setas (ex: "(F7) -> Bb7") antes
  // de validar os tokens. Retorna a string com () e setas substituídos por
  // espaços de mesmo comprimento para preservar as posições originais dos acordes.
  const substituida = linha
    .replace(/[()]/g, ' ')
    .replace(/-+>/g, m => ' '.repeat(m.length))
    .replace(/[→➜⟶🡪]/g, ' ');
  const normalizada = substituida.trim();
  if (!normalizada) return null;
  const tokens = normalizada.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length > 0 && tokens.every(t => REGEX_ACORDE.test(t))) return substituida;
  return null;
}

function inferirTipo(nome: string): TipoSecao {
  const n = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/\btab\b/.test(n)) return 'tab';
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

export function parseCifraTexto(texto: string): Secao[] {
  const secoes: Secao[] = [];
  let secaoAtual: Secao = { tipo: 'verso', label: 'Verso 1', linhas: [] };
  let acordesPendentes: string | null = null;
  let rawPendente: string | null = null; // texto original da linha de acordes (com parênteses)
  // Linhas acumuladas para seções tab
  let tabLinhas: string[] = [];

  const flushAcordes = () => {
    if (acordesPendentes !== null) {
      const l = parseLinhaCifra('', acordesPendentes);
      if (rawPendente) l.rawChordsLine = rawPendente;
      secaoAtual.linhas.push(l);
      acordesPendentes = null;
      rawPendente = null;
    }
  };

  const pushSecaoAtual = () => {
    if (secaoAtual.tipo === 'tab') {
      const tabText = tabLinhas.join('\n').trim();
      if (tabText) secoes.push({ ...secaoAtual, tabText, linhas: [] });
      tabLinhas = [];
    } else if (secaoAtual.linhas.length > 0) {
      secoes.push(secaoAtual);
    }
  };

  for (const linha of texto.split('\n')) {
    const secaoMatch = linha.trim().match(/^\[(.+?)\]\s*(.*)/);
    if (secaoMatch) {
      flushAcordes();
      pushSecaoAtual();
      const nome = secaoMatch[1].trim();
      const tipo = inferirTipo(nome);
      secaoAtual = { tipo, label: nome, linhas: [] };
      tabLinhas = [];
      if (tipo !== 'tab') {
        const resto = secaoMatch[2].trim();
        if (resto) {
          const acordes = extrairAcordesLinha(resto);
          if (acordes) acordesPendentes = acordes;
        }
      }
      continue;
    }

    // Seção tab: acumula todas as linhas como texto bruto
    if (secaoAtual.tipo === 'tab') {
      tabLinhas.push(linha);
      continue;
    }

    // Se a linha é tablatura mas não estamos numa seção tab, abre uma seção tab automática
    if (isTabLine(linha)) {
      flushAcordes();
      pushSecaoAtual();
      secaoAtual = { tipo: 'tab', label: 'Tab', linhas: [] };
      tabLinhas = [linha];
      continue;
    }

    if (!linha.trim()) { flushAcordes(); continue; }

    const acordesLinha = extrairAcordesLinha(linha);
    if (acordesLinha !== null) {
      flushAcordes();
      acordesPendentes = acordesLinha;
      rawPendente = HAS_PARENS_ARROWS.test(linha) ? linha.trimEnd() : null;
      continue;
    }

    const letra = linha.trimEnd();
    if (acordesPendentes !== null) {
      const l = parseLinhaCifra(letra, acordesPendentes);
      if (rawPendente) l.rawChordsLine = rawPendente;
      secaoAtual.linhas.push(l);
      acordesPendentes = null;
      rawPendente = null;
    } else {
      secaoAtual.linhas.push({ letra, acordes: [] });
    }
  }

  flushAcordes();
  pushSecaoAtual();

  return secoes.length > 0
    ? secoes
    : [{ tipo: 'verso', label: 'Verso 1', linhas: [{ letra: '', acordes: [] }] }];
}

export function cifraToTexto(secoes: Secao[]): string {
  const lines: string[] = [];
  for (const secao of secoes) {
    lines.push(`[${secao.label}]`);
    if (secao.tipo === 'tab') {
      lines.push(secao.tabText ?? '');
    } else {
      for (const linha of secao.linhas) {
        if (linha.acordes.length > 0) {
          if (linha.rawChordsLine !== undefined) {
            lines.push(linha.rawChordsLine);
          } else {
            const maxEnd = Math.max(...linha.acordes.map(a => a.posicao + a.acorde.length));
            const buf = Array<string>(Math.max(maxEnd, 1)).fill(' ');
            for (const a of linha.acordes) {
              for (let i = 0; i < a.acorde.length; i++) {
                buf[a.posicao + i] = a.acorde[i];
              }
            }
            lines.push(buf.join('').trimEnd());
          }
        }
        if (linha.letra) lines.push(linha.letra);
        else if (linha.acordes.length === 0) lines.push('');
      }
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
