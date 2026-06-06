import { describe, it, expect } from 'vitest';
import { parseCifraTexto, cifraToTexto } from './cifra-parser';

describe('parseCifraTexto', () => {
  it('retorna seção padrão para texto vazio', () => {
    const secoes = parseCifraTexto('');
    expect(secoes).toHaveLength(1);
    expect(secoes[0].tipo).toBe('verso');
    expect(secoes[0].label).toBe('Verso 1');
  });

  it('cria seção a partir de cabeçalho [Nome]', () => {
    const secoes = parseCifraTexto('[Refrão]\nAlegria');
    expect(secoes[0].tipo).toBe('refrao');
    expect(secoes[0].label).toBe('Refrão');
    expect(secoes[0].linhas[0].letra).toBe('Alegria');
  });

  it('infere tipo correto dos cabeçalhos', () => {
    // Cada seção precisa de ao menos uma linha para ser salva
    const casos: [string, string][] = [
      ['[Verso 1]\nAlegria', 'verso'],
      ['[Refrão]\nAlegria', 'refrao'],
      ['[Pré-Refrão]\nAlegria', 'pre-refrao'],
      ['[Ponte]\nAlegria', 'ponte'],
      ['[Intro]\nAlegria', 'intro'],
      ['[Solo]\nAlegria', 'solo'],
      ['[Tab]\nE|---0---|', 'tab'],
      ['[Outro]\nAlegria', 'outro'],
    ];
    for (const [texto, tipo] of casos) {
      const secoes = parseCifraTexto(texto);
      expect(secoes[0].tipo, `tipo de "${texto.split('\n')[0]}"`).toBe(tipo);
    }
  });

  it('associa linha de acordes à linha de letra seguinte', () => {
    const texto = '[Verso 1]\nC  G\nOlá mundo';
    const secoes = parseCifraTexto(texto);
    const linha = secoes[0].linhas[0];
    expect(linha.letra).toBe('Olá mundo');
    expect(linha.acordes).toHaveLength(2);
    expect(linha.acordes[0].acorde).toBe('C');
    expect(linha.acordes[1].acorde).toBe('G');
  });

  it('detecta posição correta dos acordes', () => {
    const texto = '[Verso 1]\nC    Am\nLetra';
    const secoes = parseCifraTexto(texto);
    const acordes = secoes[0].linhas[0].acordes;
    expect(acordes[0].posicao).toBe(0);
    expect(acordes[1].posicao).toBe(5);
  });

  it('linha sem letra após acordes fica com letra vazia', () => {
    const texto = '[Verso 1]\nC  G\n';
    const secoes = parseCifraTexto(texto);
    const linha = secoes[0].linhas[0];
    expect(linha.letra).toBe('');
    expect(linha.acordes).toHaveLength(2);
  });

  it('separa múltiplas seções corretamente', () => {
    const texto = '[Verso 1]\nletra1\n\n[Refrão]\nletra2';
    const secoes = parseCifraTexto(texto);
    expect(secoes).toHaveLength(2);
    expect(secoes[0].tipo).toBe('verso');
    expect(secoes[1].tipo).toBe('refrao');
  });

  it('detecta seção de tab automaticamente', () => {
    const texto = 'E|---0---3---|\nB|---1---3---|';
    const secoes = parseCifraTexto(texto);
    expect(secoes[0].tipo).toBe('tab');
    expect(secoes[0].tabText).toContain('E|');
  });

  it('não trata palavras que começam com nota como acordes', () => {
    // Palavras que começam com A-G mas não são acordes
    const palavras = ['Amar', 'Alegria', 'Glória', 'Graças', 'Bendito', 'Eterno', 'Fiel'];
    for (const palavra of palavras) {
      const secoes = parseCifraTexto(`[Verso 1]\n${palavra}`);
      expect(secoes[0].linhas[0].letra, `"${palavra}" deve ser letra`).toBe(palavra);
    }
  });

  it('lida com acordes entre parênteses', () => {
    const texto = '[Verso 1]\n(C) (Am)\nLetra';
    const secoes = parseCifraTexto(texto);
    const linha = secoes[0].linhas[0];
    expect(linha.acordes.length).toBeGreaterThanOrEqual(2);
  });
});

describe('cifraToTexto', () => {
  it('serializa seção com linhas de acordes e letra', () => {
    const secoes = [
      {
        tipo: 'verso' as const,
        label: 'Verso 1',
        linhas: [
          { letra: 'Olá', acordes: [{ acorde: 'C', posicao: 0 }] },
        ],
      },
    ];
    const texto = cifraToTexto(secoes);
    expect(texto).toContain('[Verso 1]');
    expect(texto).toContain('C');
    expect(texto).toContain('Olá');
  });

  it('serializa seção de tab com tabText', () => {
    const secoes = [
      {
        tipo: 'tab' as const,
        label: 'Tab',
        linhas: [],
        tabText: 'E|---0---|',
      },
    ];
    const texto = cifraToTexto(secoes);
    expect(texto).toContain('[Tab]');
    expect(texto).toContain('E|---0---|');
  });

  it('round-trip: parse → texto → parse produz mesma estrutura', () => {
    const original = '[Verso 1]\nC  G\nOlá mundo\n\n[Refrão]\nAm\nAlegria';
    const secoes = parseCifraTexto(original);
    const serializado = cifraToTexto(secoes);
    const secoes2 = parseCifraTexto(serializado);
    expect(secoes2).toHaveLength(secoes.length);
    expect(secoes2[0].tipo).toBe(secoes[0].tipo);
    expect(secoes2[1].tipo).toBe(secoes[1].tipo);
    expect(secoes2[0].linhas[0].letra).toBe(secoes[0].linhas[0].letra);
    expect(secoes2[0].linhas[0].acordes[0].acorde).toBe(secoes[0].linhas[0].acordes[0].acorde);
  });
});
