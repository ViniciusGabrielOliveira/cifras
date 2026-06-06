import { describe, it, expect } from 'vitest';
import { newId } from './id.utils';

describe('newId', () => {
  it('inclui o prefixo no ID gerado', () => {
    expect(newId('m')).toMatch(/^m-/);
    expect(newId('lista')).toMatch(/^lista-/);
  });

  it('gera IDs únicos em chamadas consecutivas', () => {
    const ids = new Set(Array.from({ length: 20 }, () => newId('x')));
    expect(ids.size).toBe(20);
  });

  it('retorna uma string', () => {
    expect(typeof newId('tok')).toBe('string');
  });
});
