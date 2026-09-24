import { describe, expect, it } from 'vitest';
import { slidesDaCifra } from './projecao';
import { Cifra, Secao } from '../models/cifra.model';

function cifra(secoes: Secao[]): Cifra {
  return { id: 'teste', titulo: 'Teste', artista: '', tom: 'C', instrumento: 'violao', dificuldade: 'basico', composicao: '', secoes };
}

function verso(letras: string[]): Secao {
  return { tipo: 'verso', label: 'Verso', linhas: letras.map(letra => ({ letra, acordes: [{ posicao: 0, acorde: 'Am7' }] })) };
}

describe('letras para projeção', () => {
  it('projeta letras sem acordes, rótulos ou tablaturas, preservando o cadastro', () => {
    const musica = cifra([verso(['  Minha canção  ', '']), { tipo: 'tab', label: 'Solo', linhas: [{ letra: 'e|--0--', acordes: [] }], tabText: 'e|--0--' }]);
    const original = structuredClone(musica);
    expect(slidesDaCifra(musica)).toEqual(['Minha canção']);
    expect(musica).toEqual(original);
  });

  it('preserva a ordem e repetições do refrão', () => {
    const refrao: Secao = { ...verso(['Aleluia']), tipo: 'refrao' };
    expect(slidesDaCifra(cifra([refrao, verso(['Cantamos']), refrao]))).toEqual(['Aleluia', 'Cantamos', 'Aleluia']);
  });

  it('divide trechos longos e respeita as separações de estrofes', () => {
    expect(slidesDaCifra(cifra([verso(['um', 'dois', 'três', 'quatro', 'cinco', '', 'seis'])])))
      .toEqual(['um\ndois\ntrês\nquatro', 'cinco', 'seis']);
  });

  it('não cria slides para músicas instrumentais ou vazias', () => {
    expect(slidesDaCifra(cifra([verso(['', '   '])]))).toEqual([]);
    expect(slidesDaCifra(cifra([]))).toEqual([]);
  });
});
