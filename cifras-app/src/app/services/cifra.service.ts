import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Cifra } from '../models/cifra.model';
import { CifraRepository } from '../repositories/cifra.repository.interface';
import { AcordesService } from './acordes.service';

/**
 * Camada de serviço — regras de negócio sobre cifras.
 * As páginas/componentes injetam ESTE service, nunca o repositório diretamente.
 * O service delega ao CifraRepository para acesso a dados.
 */
@Injectable({ providedIn: 'root' })
export class CifraService {
  private repo = inject(CifraRepository);
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
   * Persiste as alterações no repositório.
   * Retorna um Observable<Cifra> com a versão salva.
   */
  salvarCifra(cifra: Cifra): Observable<Cifra> {
    return this.repo.updateCifra(cifra);
  }
}
