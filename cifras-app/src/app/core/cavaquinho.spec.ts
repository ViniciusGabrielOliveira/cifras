import { describe, expect, it } from 'vitest';
import { AFINACAO_CAVACO, gerarDiagramasCavaco } from './cavaquinho';
import { DiagramaAcorde } from '../models/diagrama.model';

function sons(d: DiagramaAcorde): number[] {
  return [4, 3, 2, 1].map((corda, i) => AFINACAO_CAVACO[i] + (d.dedos.find(f => f.corda === corda)?.casa ?? 0));
}

describe('diagramas de cavaquinho em Ré Sol Si Ré', () => {
  const casos: [string, number[]][] = [
    ['C', [0, 4, 7]], ['G', [7, 11, 2]], ['Am', [9, 0, 4]],
    ['Gm7', [7, 10, 2, 5]], ['F7M', [5, 9, 0, 4]], ['GM7', [7, 11, 2, 6]],
    ['C7(9-)', [0, 4, 10, 1]], ['Gb7(5-)', [6, 10, 0, 4]],
    ['D9', [2, 6, 0, 4]], ['Cdim7', [0, 3, 6, 9]], ['Am7M', [9, 0, 4, 8]],
    ['C7sus4', [0, 5, 7, 10]], ['Cadd9', [0, 4, 7, 2]],
    ['C6/9', [0, 4, 9, 2]], ['C7+', [0, 4, 7, 11]], ['C5+', [0, 4, 8]],
  ];
  for (const [nome, notas] of casos) {
    it(`desenha ${nome} com as notas corretas nas quatro cordas`, () => {
      const diagramas = gerarDiagramasCavaco(nome);
      expect(diagramas.length).toBeGreaterThan(0);
      for (const d of diagramas) {
        expect([...new Set(sons(d).map(n => n % 12))].sort()).toEqual([...notas].sort());
        expect(d.dedos.every(f => f.corda >= 1 && f.corda <= 4 && f.casa >= d.casaBase && f.casa < d.casaBase + 5)).toBe(true);
        expect(d.dedos.length + d.cordasSoltas.length).toBe(4);
      }
    });
  }

  it('usa as quatro cordas soltas para Sol maior', () => {
    expect(gerarDiagramasCavaco('G')[0].cordasSoltas).toEqual([4, 3, 2, 1]);
  });

  it('preserva o baixo de uma inversão', () => {
    for (const nome of ['C/E', 'G/B', 'D/F#']) {
      const ds = gerarDiagramasCavaco(nome);
      expect(ds.length).toBeGreaterThan(0);
      const baixo = nome.endsWith('E') ? 4 : nome.endsWith('B') ? 11 : 6;
      for (const d of ds) expect(Math.min(...sons(d)) % 12).toBe(baixo);
    }
  });

  it('aceita equivalentes enarmônicos', () => {
    expect(gerarDiagramasCavaco('F#7').map(sons)).toEqual(gerarDiagramasCavaco('Gb7').map(sons));
  });

  it('oferece posições para maiores e menores em todos os tons', () => {
    for (const raiz of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
      for (const tipo of ['', 'm', '7', 'm7', 'maj7', 'm7(b5)', '6', 'm6', '9']) {
        expect(gerarDiagramasCavaco(raiz + tipo).length, raiz + tipo).toBeGreaterThan(0);
      }
    }
  });

  it('não inventa posições para símbolos desconhecidos ou incompletos', () => {
    for (const nome of ['', 'Alegria', 'Cfoo', 'C7(b9#11)', 'H7', 'C7(']) {
      expect(gerarDiagramasCavaco(nome), nome).toEqual([]);
    }
  });
});
