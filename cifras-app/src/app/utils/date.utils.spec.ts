import { describe, it, expect } from 'vitest';
import { formatarDataCurta, formatarDataLonga } from './date.utils';

describe('formatarDataCurta', () => {
  it('formata data no padrão DD/MM/AAAA', () => {
    expect(formatarDataCurta('2025-12-25')).toBe('25/12/2025');
  });

  it('retorna "—" para string vazia', () => {
    expect(formatarDataCurta('')).toBe('—');
  });

  it('retorna "—" para undefined', () => {
    expect(formatarDataCurta(undefined)).toBe('—');
  });
});

describe('formatarDataLonga', () => {
  it('inclui dia da semana na saída', () => {
    const resultado = formatarDataLonga('2025-12-25');
    // 25/12/2025 é quinta-feira
    expect(resultado.toLowerCase()).toContain('quinta');
  });

  it('inclui o nome do mês por extenso', () => {
    const resultado = formatarDataLonga('2025-06-01');
    expect(resultado.toLowerCase()).toContain('junho');
  });

  it('retorna string vazia para undefined', () => {
    expect(formatarDataLonga(undefined)).toBe('');
  });
});
