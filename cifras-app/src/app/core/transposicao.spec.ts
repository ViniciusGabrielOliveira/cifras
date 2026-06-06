import { describe, it, expect } from 'vitest';
import { calcularDelta, transporAcorde, transporCifra } from './transposicao';
import { Cifra } from '../models/cifra.model';

describe('calcularDelta', () => {
  it('retorna 0 para mesma nota', () => {
    expect(calcularDelta('C', 'C')).toBe(0);
  });

  it('sobe 7 semitons de C para G', () => {
    expect(calcularDelta('C', 'G')).toBe(7);
  });

  it('sobe 5 semitons de G para C', () => {
    expect(calcularDelta('G', 'C')).toBe(5);
  });

  it('sobe 1 semitom de C para Db', () => {
    expect(calcularDelta('C', 'Db')).toBe(1);
  });

  it('trata enarmônicos corretamente: Bb = A#', () => {
    expect(calcularDelta('A', 'Bb')).toBe(calcularDelta('A', 'A#'));
  });

  it('ignora sufixo de modo menor nos toms', () => {
    expect(calcularDelta('Am', 'Em')).toBe(calcularDelta('A', 'E'));
  });

  it('retorna 0 para nota inválida', () => {
    expect(calcularDelta('X', 'C')).toBe(0);
  });
});

describe('transporAcorde', () => {
  it('transpõe acorde simples', () => {
    expect(transporAcorde('C', 2)).toBe('D');
  });

  it('transpõe acorde com modo', () => {
    expect(transporAcorde('Am', 3)).toBe('Cm');
  });

  it('transpõe acorde com sétima', () => {
    expect(transporAcorde('G7', 5)).toBe('C7');
  });

  it('transpõe acorde com baixo', () => {
    expect(transporAcorde('G/B', 5)).toBe('C/E');
  });

  it('volta ao início após 12 semitons', () => {
    expect(transporAcorde('C', 12)).toBe('C');
  });

  it('transpõe para baixo com delta negativo', () => {
    expect(transporAcorde('D', -2)).toBe('C');
  });

  it('retorna string original para acorde inválido', () => {
    expect(transporAcorde('naoacorde', 3)).toBe('naoacorde');
  });
});

describe('transporCifra', () => {
  const cifraBase: Cifra = {
    id: '1',
    titulo: 'Teste',
    artista: 'Artista',
    tom: 'C',
    instrumento: 'violao',
    dificuldade: 'basico',
    composicao: '',
    categorias: [],
    partesMissa: [],
    secoes: [
      {
        tipo: 'verso',
        label: 'Verso 1',
        linhas: [
          { letra: 'linha', acordes: [{ acorde: 'C', posicao: 0 }, { acorde: 'G', posicao: 2 }] },
          { letra: '', acordes: [] },
        ],
      },
      {
        tipo: 'tab',
        label: 'Tab',
        linhas: [],
        tabText: 'E|---0---|\nB|---1---|',
      },
    ],
  };

  it('retorna a mesma cifra se delta = 0', () => {
    expect(transporCifra(cifraBase, 0)).toBe(cifraBase);
  });

  it('transpõe o tom da cifra', () => {
    const resultado = transporCifra(cifraBase, 5);
    expect(resultado.tom).toBe('F');
  });

  it('transpõe os acordes das linhas', () => {
    const resultado = transporCifra(cifraBase, 5);
    const acordes = resultado.secoes[0].linhas[0].acordes;
    expect(acordes[0].acorde).toBe('F');
    expect(acordes[1].acorde).toBe('C');
  });

  it('não altera seções de tab', () => {
    const resultado = transporCifra(cifraBase, 5);
    expect(resultado.secoes[1]).toStrictEqual(cifraBase.secoes[1]);
  });

  it('não muta a cifra original', () => {
    transporCifra(cifraBase, 5);
    expect(cifraBase.tom).toBe('C');
  });
});
