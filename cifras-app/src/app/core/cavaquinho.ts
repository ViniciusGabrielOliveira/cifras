import { DiagramaAcorde } from '../models/diagrama.model';

/** Cordas da esquerda para a direita: 4ª Ré, 3ª Sol, 2ª Si, 1ª Ré. */
export const AFINACAO_CAVACO = [62, 67, 71, 74] as const;
const NOTAS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FORMULAS: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], dim7: [0, 3, 6, 9],
  aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7],
  '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], mmaj7: [0, 3, 7, 11],
  '9': [0, 4, 7, 10, 2], m9: [0, 3, 7, 10, 2], maj9: [0, 4, 7, 11, 2],
  '11': [0, 4, 10, 5], m11: [0, 3, 10, 5],
  '13': [0, 4, 10, 9], m13: [0, 3, 10, 9], maj13: [0, 4, 11, 9],
  add9: [0, 4, 7, 2], madd9: [0, 3, 7, 2],
  '6/9': [0, 4, 9, 2], 'm6/9': [0, 3, 9, 2],
  '7sus4': [0, 5, 7, 10], '7sus2': [0, 2, 7, 10],
};
const GRAUS: Record<string, number> = { '5': 7, '6': 9, '7': 10, '9': 2, '11': 5, '13': 9 };

function nota(nome: string): number {
  return (NOTAS[nome[0]] + (nome[1] === '#' ? 1 : nome[1] === 'b' ? -1 : 0) + 12) % 12;
}

function analisar(nome: string): { notas: number[]; baixo?: number } | null {
  const match = nome.trim().match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
  if (!match) return null;
  let parenteses = 0;
  for (const char of match[2]) {
    if (char === '(' && ++parenteses > 1) return null;
    if (char === ')' && --parenteses < 0) return null;
  }
  if (parenteses !== 0) return null;
  const raiz = nota(match[1]);
  let sufixo = match[2].replace(/min/g, 'm').replace(/°/g, 'dim').replace(/ø/g, 'm7(b5)');
  sufixo = sufixo.replace(/M(7|9|13)/g, 'maj$1').replace(/(7|9|13)M/g, 'maj$1');
  sufixo = sufixo.replace(/7\+(?=$|\()/, 'maj7');
  if (sufixo === '5+') sufixo = 'aug';
  if (sufixo === 'M') sufixo = '';
  if (sufixo === '+') sufixo = 'aug';
  if (sufixo === 'sus') sufixo = 'sus4';
  const base = Object.keys(FORMULAS).sort((a, b) => b.length - a.length).find(k => sufixo.startsWith(k))!;
  let intervalos = [...FORMULAS[base]];
  let restante = sufixo.slice(base.length).replace(/[()]/g, '');
  while (restante) {
    const alteracao = restante.match(/^(add|sus)?([#b]?)(5|6|7|9|11|13)([+−-]?)(?:[,/])?/);
    if (!alteracao) return null;
    const [, tipo, antes, grau, depois] = alteracao;
    if (antes && depois) return null;
    const natural = GRAUS[grau];
    const delta = antes === 'b' || depois === '-' || depois === '−' ? -1 : antes === '#' || depois === '+' ? 1 : 0;
    if (tipo === 'sus') intervalos = intervalos.filter(n => n !== 3 && n !== 4);
    if (delta) intervalos = intervalos.filter(n => n !== natural);
    intervalos.push((natural + delta + 12) % 12);
    restante = restante.slice(alteracao[0].length);
  }
  intervalos = [...new Set(intervalos)];
  const baixo = match[3] ? nota(match[3]) : undefined;
  let notas = [...new Set(intervalos.map(n => (n + raiz) % 12).concat(baixo === undefined ? [] : [baixo]))];
  // Em quatro cordas, a quinta justa pode ser omitida; alterações são mantidas.
  if (notas.length > 4 && baixo !== (raiz + 7) % 12) notas = notas.filter(n => n !== (raiz + 7) % 12);
  return notas.length <= 4 ? { notas, baixo } : null;
}

/** Busca posições tocáveis; nunca reutiliza desenhos de violão no cavaquinho. */
export function gerarDiagramasCavaco(nome: string): DiagramaAcorde[] {
  const acorde = analisar(nome);
  if (!acorde) return [];
  const opcoes = AFINACAO_CAVACO.map(sol => Array.from({ length: 16 }, (_, casa) => casa)
    .filter(casa => acorde.notas.includes((sol + casa) % 12)));
  const posicoes: { casas: number[]; score: number }[] = [];
  const buscar = (casas: number[]) => {
    if (casas.length < 4) {
      for (const casa of opcoes[casas.length]) buscar([...casas, casa]);
      return;
    }
    const presas = casas.filter(c => c > 0);
    const min = presas.length ? Math.min(...presas) : 0;
    const max = Math.max(...casas);
    if (max - min > 3) return;
    const sons = casas.map((c, i) => AFINACAO_CAVACO[i] + c);
    if (!acorde.notas.every(n => sons.some(s => s % 12 === n))) return;
    if (acorde.baixo !== undefined && Math.min(...sons) % 12 !== acorde.baixo) return;
    // Favorece posições próximas da pestana e pouco alongamento.
    posicoes.push({ casas, score: max * 3 + (max - min) * 2 + presas.length });
  };
  buscar([]);
  posicoes.sort((a, b) => a.score - b.score);
  return posicoes.slice(0, 3).map(({ casas }, i) => ({
    nome, variacao: `Posição ${i + 1}`,
    casaBase: Math.max(...casas) <= 5 ? 1 : Math.min(...casas.filter(c => c > 0)),
    dedos: casas.flatMap((casa, index) => casa > 0 ? [{ corda: 4 - index, casa }] : []),
    cordasSoltas: casas.flatMap((casa, index) => casa === 0 ? [4 - index] : []),
    cordasMutadas: [],
  }));
}
