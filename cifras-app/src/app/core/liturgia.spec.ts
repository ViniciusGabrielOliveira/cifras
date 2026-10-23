import { describe, expect, it } from 'vitest';
import { dataLiturgicaHoje, escolherSugestao, listasElegiveis } from './liturgia';
import { Lista } from '../models/lista.model';
import { DiaLiturgico } from '../models/liturgia.model';

const dia: DiaLiturgico = { id: 'ordinary_time_29_sunday', nome: '29º Domingo', tempo: 'tempo-comum', cor: 'verde', ciclo: 'C', propria: false, grau: 'domingo', opcional: false };
function lista(id: string, campos: Partial<Lista> = {}): Lista {
  return { id, titulo: id, tipo: 'publica', criadaEm: '', atualizadaEm: '', musicas: [{ id: 'm', cifraId: 'c', nome: 'Entrada', autor: '', parte: 'entrada', ordem: 0 }], ...campos };
}
const ids = (listas: Lista[]) => listas.map(l => l.id);

describe('sugestões litúrgicas', () => {
  it('usa a data paroquial em São Paulo na virada do dia UTC', () => {
    expect(dataLiturgicaHoje(new Date('2026-10-24T01:30:00Z'))).toBe('2026-10-23');
    expect(dataLiturgicaHoje(new Date('2026-10-24T03:30:00Z'))).toBe('2026-10-24');
  });
  it('dá prioridade à escolha explícita da data, mesmo sobre um intervalo antigo', () => {
    const listas = [lista('data', { datasLiturgicas: ['2026-10-23'], dataInicio: '2025-01-01', dataFim: '2025-12-31' }), lista('liturgia', { liturgiasIds: [dia.id] })];
    expect(ids(listasElegiveis(listas, '2026-10-23', dia))).toEqual(['data']);
  });
  it('preserva a prioridade das programações existentes por intervalo', () => {
    const listas = [lista('intervalo', { dataInicio: '2026-10-01', dataFim: '2026-10-31' }), lista('tempo', { liturgiasIds: ['tempo-comum'] })];
    expect(ids(listasElegiveis(listas, '2026-10-23', dia))).toEqual(['intervalo']);
  });
  it('prefere a celebração e o ciclo exatos ao repertório geral do tempo', () => {
    const listas = [lista('tempo', { liturgiasIds: ['tempo-comum'] }), lista('todos', { liturgiasIds: [dia.id] }), lista('ano-c', { liturgiasIds: [dia.id], ciclosLiturgicos: ['C'] }), lista('ano-a', { liturgiasIds: [dia.id], ciclosLiturgicos: ['A'] })];
    expect(ids(listasElegiveis(listas, '2026-10-23', dia))).toEqual(['ano-c']);
  });
  it('aceita a mesma lista em várias celebrações e mantém músicas e ordem intactas', () => {
    const compartilhada = lista('compartilhada', { liturgiasIds: ['outro-dia', dia.id] });
    const resultado = listasElegiveis([compartilhada], '2026-10-23', dia);
    expect(resultado[0]).toBe(compartilhada);
    expect(resultado[0].musicas).toBe(compartilhada.musicas);
  });
  it('usa o tempo como alternativa e respeita categorias antigas', () => {
    expect(ids(listasElegiveis([lista('antiga', { categoria: 'tempo-comum', todosDias: true })], '2026-10-23', dia))).toEqual(['antiga']);
  });
  it('não oferece repertório genérico em uma celebração com estrutura própria', () => {
    expect(listasElegiveis([lista('geral', { liturgiasIds: ['quaresma'], todosDias: true })], '2026-04-03', { ...dia, id: 'friday_of_the_passion_of_the_lord', tempo: 'quaresma', propria: true })).toEqual([]);
  });
  it('exclui listas privadas, vazias, vencidas e de outro ciclo', () => {
    const listas = [lista('privada', { tipo: 'privada' }), lista('vazia', { musicas: [] }), lista('vencida', { dataFim: '2026-09-01' }), lista('outro-ciclo', { ciclosLiturgicos: ['A'] })].map(l => ({ ...l, liturgiasIds: [dia.id] }));
    expect(listasElegiveis(listas, '2026-10-23', dia)).toEqual([]);
  });
  it('não reutiliza uma lista de todos os dias em outro tempo litúrgico', () => {
    expect(listasElegiveis([lista('comum', { todosDias: true, categoria: 'tempo-comum' })], '2026-12-01', { ...dia, tempo: 'advento' })).toEqual([]);
  });
  it('outra sugestão evita a lista atual e lida com zero ou uma opção', () => {
    expect(escolherSugestao([lista('a'), lista('b')], 'a')?.id).toBe('b');
    expect(escolherSugestao([lista('a')], 'a')?.id).toBe('a');
    expect(escolherSugestao([])).toBeUndefined();
  });
});
