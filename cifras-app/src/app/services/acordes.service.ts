import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, tap, map } from 'rxjs';
import { DiagramaAcorde } from '../models/diagrama.model';
import { Cifra } from '../models/cifra.model';
import { AcordeRepository } from '../repositories/acorde.repository.interface';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AcordesService {
  private repo = inject(AcordeRepository);
  private http = inject(HttpClient);
  private cache = new Map<string, DiagramaAcorde[]>();

  /**
   * Pré-carrega os acordes solicitados e os salva no cache em memória.
   * Acordes que já estão no cache são ignorados.
   */
  preCarregarAcordes(nomes: string[]): Observable<void> {
    const faltantes = nomes.filter(n => !this.cache.has(n));
    if (faltantes.length === 0) {
      return of(undefined);
    }
    
    return this.repo.getAcordes(faltantes).pipe(
      tap(acordesMap => {
        Object.entries(acordesMap).forEach(([nome, diags]) => {
          this.cache.set(nome, diags);
        });
      }),
      map(() => undefined)
    );
  }

  /**
   * Retorna as variações de um acorde de forma síncrona, a partir do cache.
   */
  getVariacoes(acorde: string): DiagramaAcorde[] {
    return this.cache.get(acorde) ?? [];
  }

  /**
   * Extrai os acordes de uma cifra e pede à API Python para cadastrar
   * os que ainda não existem no Firestore. Fire-and-forget.
   */
  syncAcordes(cifra: Cifra): void {
    const nomes = new Set<string>();
    for (const secao of cifra.secoes) {
      for (const linha of secao.linhas) {
        for (const a of linha.acordes) {
          if (a.acorde) nomes.add(a.acorde);
        }
      }
    }
    if (nomes.size === 0) return;

    this.http.post(
      `${environment.cifrasApiUrl}/acordes/sync`,
      { acordes: [...nomes] },
      { headers: new HttpHeaders({ 'X-API-Key': environment.cifrasApiKey }) },
    ).subscribe({ error: () => {} });
  }
}
