import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Cifra } from '../models/cifra.model';
import { CifraRepository } from '../repositories/cifra.repository';
import { CifraMockRepository } from '../repositories/cifra-mock.repository';

/**
 * Camada de serviço — regras de negócio sobre cifras.
 * As páginas/componentes injetam ESTE service, nunca o repositório diretamente.
 * O service delega ao CifraRepository para acesso a dados.
 */
@Injectable({ providedIn: 'root' })
export class CifraService {
  private repo = inject(CifraRepository);
  private mockRepo = inject(CifraMockRepository);

  getCifra(id: string): Observable<Cifra | undefined> {
    return this.repo.getCifra(id);
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
