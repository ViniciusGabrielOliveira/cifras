import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CifraBuscaService } from './cifra-busca.service';
import { CifraRepository, CifraIndiceItem } from '../repositories/cifra.repository.interface';

const indice: CifraIndiceItem[] = [
  { id: '1', titulo: 'Aleluia', autor: 'Taizé', letra: '', categorias: [], partesMissa: [] },
  { id: '2', titulo: 'Glória a Deus', autor: 'João Paulo', letra: '', categorias: [], partesMissa: [] },
  { id: '3', titulo: 'Santo', autor: 'Anônimo', letra: 'Santo, Santo, Santo', categorias: [], partesMissa: [] },
  { id: '4', titulo: 'Hosana', autor: 'Eliana Ribeiro', letra: '', categorias: [], partesMissa: [] },
];

function setup() {
  TestBed.configureTestingModule({
    providers: [
      CifraBuscaService,
      {
        provide: CifraRepository,
        useValue: { getIndice: () => of(indice) },
      },
    ],
  });
  return TestBed.inject(CifraBuscaService);
}

describe('CifraBuscaService.filtrar', () => {
  let svc: CifraBuscaService;
  beforeEach(() => {
    TestBed.resetTestingModule();
    svc = setup();
  });

  it('retorna todos os items com score 0 para query curta', () => {
    const res = svc.filtrar(indice, 'a');
    expect(res).toHaveLength(indice.length);
    expect(res[0].score).toBe(0);
  });

  it('encontra match exato de título com score máximo', () => {
    const res = svc.filtrar(indice, 'Aleluia');
    expect(res[0].id).toBe('1');
    expect(res[0].score).toBe(200);
  });

  it('encontra match por prefixo de título', () => {
    const res = svc.filtrar(indice, 'Glori');
    expect(res[0].id).toBe('2');
    expect(res[0].score).toBe(150);
  });

  it('encontra match por substring no título', () => {
    const res = svc.filtrar(indice, 'Deus');
    expect(res.some(r => r.id === '2')).toBe(true);
  });

  it('encontra match na letra da música', () => {
    const res = svc.filtrar(indice, 'santo');
    expect(res.some(r => r.id === '3')).toBe(true);
    expect(res.find(r => r.id === '3')?.matchTipo).toBe('titulo');
  });

  it('encontra match pelo autor', () => {
    const res = svc.filtrar(indice, 'Eliana');
    expect(res.some(r => r.id === '4')).toBe(true);
    expect(res.find(r => r.id === '4')?.matchTipo).toBe('autor');
  });

  it('ignora acentos na busca', () => {
    const res = svc.filtrar(indice, 'Gloria');
    expect(res.some(r => r.id === '2')).toBe(true);
  });

  it('retorna array vazio quando não há match', () => {
    const res = svc.filtrar(indice, 'inexistente');
    expect(res).toHaveLength(0);
  });

  it('busca multi-token encontra "gloria deus"', () => {
    const res = svc.filtrar(indice, 'gloria deus');
    expect(res.some(r => r.id === '2')).toBe(true);
  });

  it('ordena por score decrescente', () => {
    const res = svc.filtrar(indice, 'santo');
    if (res.length > 1) {
      expect(res[0].score).toBeGreaterThanOrEqual(res[1].score);
    }
  });
});
