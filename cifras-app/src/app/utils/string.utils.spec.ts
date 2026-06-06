import { describe, it, expect } from 'vitest';
import { slugify } from './string.utils';

describe('slugify', () => {
  it('converte para minúsculas', () => {
    expect(slugify('ALELUIA')).toBe('aleluia');
  });

  it('remove acentos', () => {
    expect(slugify('Ação')).toBe('acao');
    expect(slugify('Pré-Refrão')).toBe('pre-refrao');
  });

  it('substitui espaços por hífens', () => {
    expect(slugify('Olá Mundo')).toBe('ola-mundo');
  });

  it('remove caracteres especiais', () => {
    expect(slugify('Glória! (Deus)')).toBe('gloria-deus');
  });

  it('colapsa hífens consecutivos', () => {
    expect(slugify('a  b')).toBe('a-b');
  });

  it('remove hífens nas extremidades', () => {
    expect(slugify(' teste ')).toBe('teste');
  });

  it('limita a 80 caracteres', () => {
    const longa = 'a'.repeat(100);
    expect(slugify(longa).length).toBeLessThanOrEqual(80);
  });

  it('retorna string vazia para texto vazio', () => {
    expect(slugify('')).toBe('');
  });
});
