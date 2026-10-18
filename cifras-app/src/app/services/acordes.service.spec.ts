import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { AcordesService } from './acordes.service';
import { AcordeRepository } from '../repositories/acorde.repository.interface';
import { DiagramaAcorde } from '../models/diagrama.model';

const diagrama: DiagramaAcorde = { nome: 'C', variacao: 'Original', casaBase: 1, dedos: [], cordasMutadas: [], cordasSoltas: [] };
const resposta = { acordes: { C: { variacoes: [diagrama], variacoesCavaco: [{ ...diagrama, variacao: 'Cavaco' }] } } };

describe('AcordesService geração sob demanda', () => {
  let service: AcordesService;
  let post: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    TestBed.resetTestingModule();
    post = vi.fn(() => of(resposta));
    TestBed.configureTestingModule({ providers: [
      AcordesService,
      { provide: HttpClient, useValue: { post } },
      { provide: AcordeRepository, useValue: { getAcordes: () => of({ C: [diagrama] }) } },
    ] });
    service = TestBed.inject(AcordesService);
  });
  it('carrega ambos os instrumentos e evita novas requisições para acordes verificados', async () => {
    await firstValueFrom(service.preCarregarAcordes(['C', 'C']));
    expect(service.getVariacoes('C')).toEqual([diagrama]);
    expect(service.getVariacoes('C', 'cavaco')[0].variacao).toBe('Cavaco');
    await firstValueFrom(service.preCarregarAcordes(['C']));
    expect(post).toHaveBeenCalledTimes(1);
  });
  it('compartilha solicitações simultâneas', async () => {
    const retorno = new Subject<typeof resposta>(); post.mockReturnValue(retorno);
    const a = firstValueFrom(service.preCarregarAcordes(['C']));
    const b = firstValueFrom(service.preCarregarAcordes(['C']));
    expect(post).toHaveBeenCalledTimes(1);
    retorno.next(resposta); retorno.complete(); await Promise.all([a, b]);
  });
  it('mantém desenhos em falha de rede e permite tentar novamente', async () => {
    post.mockReturnValue(throwError(() => new Error('offline')));
    await firstValueFrom(service.preCarregarAcordes(['C']));
    expect(service.getVariacoes('C')).toEqual([diagrama]);
    post.mockReturnValue(of(resposta)); await firstValueFrom(service.preCarregarAcordes(['C']));
    expect(post).toHaveBeenCalledTimes(2);
    expect(service.getVariacoes('C', 'cavaco').length).toBe(1);
  });
  it('envia nomes com símbolos como dados JSON', async () => {
    await firstValueFrom(service.preCarregarAcordes(['C7(9-)', 'F#m7(b5)', 'A9/C#']));
    expect(post.mock.calls[0][1]).toEqual({ acordes: ['A9/C#', 'C7(9-)', 'F#m7(b5)'] });
  });
});
