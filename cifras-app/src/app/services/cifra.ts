import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Cifra } from '../models/cifra.model';
import { CifraRepository } from '../repositories/cifra.repository';
import { CifraMockRepository } from '../repositories/cifra-mock.repository';
import { AcordesService } from './acordes';

/**
 * Camada de serviço — regras de negócio sobre cifras.
 * As páginas/componentes injetam ESTE service, nunca o repositório diretamente.
 * O service delega ao CifraRepository para acesso a dados.
 */
@Injectable({ providedIn: 'root' })
export class CifraService {
  private repo = inject(CifraRepository);
  private mockRepo = inject(CifraMockRepository);
  private acordesService = inject(AcordesService);

  getCifra(id: string): Observable<Cifra | undefined> {
    return this.repo.getCifra(id).pipe(
      tap(cifra => {
        if (!cifra) return;
        const acordesSet = new Set<string>();
        for (const s of cifra.secoes) {
          for (const l of s.linhas) {
            for (const a of l.acordes) {
              acordesSet.add(a.acorde);
            }
          }
        }
        const acordesUnicos = Array.from(acordesSet);
        // Dispara o pré-carregamento sem bloquear o fluxo principal (fire and forget)
        this.acordesService.preCarregarAcordes(acordesUnicos).subscribe();
      })
    );
  }

  getAllCifras(): Observable<Cifra[]> {
    return this.repo.getAllCifras();
  }

  /**
   * Persiste as alterações no repositório (localStorage → future: API).
   * Retorna um Observable<Cifra> com a versão salva.
   */
  salvarCifra(cifra: Cifra): Observable<Cifra> {
    return this.repo.updateCifra(cifra);
  }

  /**
   * Exporta o JSON atual da cifra como download de arquivo.
   * Útil para o editor, permitindo ao usuário atualizar o mock JSON.
   */
  exportarJSON(id: string): void {
    this.mockRepo.exportJSON(id);
  }

  /** Retorna o JSON da cifra como string para copiar para clipboard */
  getJSONString(id: string): string {
    return this.mockRepo.getJSON(id);
  }

  /**
   * Descarta todas as edições (remove do localStorage)
   * e retorna à versão original do JSON asset.
   */
  resetarOriginal(id: string): Observable<Cifra | undefined> {
    return this.mockRepo.resetToOriginal(id);
  }
}
