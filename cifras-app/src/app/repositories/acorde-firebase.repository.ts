import { Injectable, inject } from '@angular/core';
import { Observable, from, of, map, forkJoin, catchError } from 'rxjs';
import { FIREBASE_APP } from '../firebase.providers';
import {
  getFirestore,
  doc,
  getDoc,
} from 'firebase/firestore';
import { DiagramaAcorde } from '../models/diagrama.model';
import { AcordeRepository } from './acorde.repository.interface';

@Injectable()
export class AcordeFirebaseRepository extends AcordeRepository {
  private app = inject(FIREBASE_APP);
  private firestore = getFirestore(this.app);

  /** Cache em memória — acordes raramente mudam */
  private cache = new Map<string, DiagramaAcorde[]>();

  override getAcordes(nomes: string[]): Observable<Record<string, DiagramaAcorde[]>> {
    const uncached = nomes.filter(n => !this.cache.has(n));

    // Se todos estão em cache, retorna imediatamente
    if (uncached.length === 0) {
      return of(this.buildResult(nomes));
    }

    // Busca os que faltam no Firestore
    const fetches$ = uncached.map(nome => {
      const docId = nome.replace(/\//g, '_');
      const acordeRef = doc(this.firestore, `acordes/${docId}`);
      return from(getDoc(acordeRef)).pipe(
        map(snap => {
          if (snap.exists()) {
            const data = snap.data() as { variacoes: DiagramaAcorde[] };
            this.cache.set(nome, data.variacoes ?? []);
          }
          return nome;
        }),
      );
    });

    return forkJoin(fetches$).pipe(
      map(() => this.buildResult(nomes)),
      catchError(() => of(this.buildResult(nomes.filter(n => this.cache.has(n))))),
    );
  }

  private buildResult(nomes: string[]): Record<string, DiagramaAcorde[]> {
    const result: Record<string, DiagramaAcorde[]> = {};
    for (const nome of nomes) {
      const cached = this.cache.get(nome);
      if (cached) {
        result[nome] = cached;
      }
    }
    return result;
  }
}
