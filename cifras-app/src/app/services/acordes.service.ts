import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, tap, map, switchMap, catchError, shareReplay, finalize, forkJoin } from 'rxjs';
import { DiagramaAcorde } from '../models/diagrama.model';
import { Cifra } from '../models/cifra.model';
import { AcordeRepository } from '../repositories/acorde.repository.interface';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AcordesService {
  private repo = inject(AcordeRepository);
  private http = inject(HttpClient);
  private cavacoCache = new Map<string, DiagramaAcorde[]>();
  private verificados = new Set<string>();
  private emAndamento = new Map<string, Observable<void>>();
  private cache = new Map<string, DiagramaAcorde[]>();

  /**
   * Pré-carrega os acordes solicitados e os salva no cache em memória.
   * Acordes que já estão no cache são ignorados.
   */
  preCarregarAcordes(nomes: string[]): Observable<void> {
    const faltantes = [...new Set(nomes)].filter(n => n && !this.verificados.has(n)).sort();
    if (!faltantes.length) return of(undefined);
    if (faltantes.length > 100) {
      const lotes = Array.from({ length: Math.ceil(faltantes.length / 100) }, (_, i) =>
        this.preCarregarAcordes(faltantes.slice(i * 100, (i + 1) * 100)));
      return forkJoin(lotes).pipe(map(() => undefined));
    }
    const key = JSON.stringify(faltantes);
    const pendente = this.emAndamento.get(key);
    if (pendente) return pendente;
    const tarefa = this.repo.getAcordes(faltantes).pipe(
      tap(mapa => Object.entries(mapa).forEach(([nome, ds]) => this.cache.set(nome, ds))),
      switchMap(() => this.http.post<{ acordes: Record<string, { variacoes: DiagramaAcorde[]; variacoesCavaco: DiagramaAcorde[] }> }>(
        `${environment.cifrasApiUrl}/acordes/sync`,
        { acordes: faltantes },
        { headers: new HttpHeaders({ 'X-API-Key': environment.cifrasApiKey }) },
      )),
      tap(resposta => Object.entries(resposta.acordes).forEach(([nome, data]) => {
        this.cache.set(nome, data.variacoes ?? []);
        this.cavacoCache.set(nome, data.variacoesCavaco ?? []);
        this.verificados.add(nome);
      })),
      map(() => undefined),
      // Falhas de rede não removem desenhos que já vieram do Firestore.
      catchError(() => of(undefined)),
      finalize(() => this.emAndamento.delete(key)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.emAndamento.set(key, tarefa);
    return tarefa;
  }

  /**
   * Retorna as variações de um acorde de forma síncrona, a partir do cache.
   */
  getVariacoes(acorde: string, instrumento: 'violao' | 'cavaco' = 'violao'): DiagramaAcorde[] {
    return (instrumento === 'cavaco' ? this.cavacoCache : this.cache).get(acorde) ?? [];
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

    this.preCarregarAcordes([...nomes]).subscribe();
  }
}
