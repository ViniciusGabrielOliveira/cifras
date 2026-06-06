import { describe, it, expect } from 'vitest';
import { isFirebaseError } from './firebase.utils';

describe('isFirebaseError', () => {
  it('reconhece objeto com code string', () => {
    expect(isFirebaseError({ code: 'permission-denied', message: 'sem permissão' })).toBe(true);
  });

  it('retorna false para Error comum', () => {
    expect(isFirebaseError(new Error('algo'))).toBe(false);
  });

  it('retorna false para null', () => {
    expect(isFirebaseError(null)).toBe(false);
  });

  it('retorna false para string', () => {
    expect(isFirebaseError('erro')).toBe(false);
  });

  it('retorna false para objeto sem code', () => {
    expect(isFirebaseError({ message: 'algo' })).toBe(false);
  });

  it('retorna false se code não for string', () => {
    expect(isFirebaseError({ code: 42 })).toBe(false);
  });
});
