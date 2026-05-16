import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, throwError, of } from 'rxjs';
import { FIREBASE_APP } from '../firebase.providers';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { ConfigItem } from '../models/config.model';
import { ConfigRepository } from './config.repository.interface';

@Injectable()
export class ConfigFirebaseRepository extends ConfigRepository {
  private app = inject(FIREBASE_APP);
  private firestore = getFirestore(this.app);

  override getCategorias(): Observable<ConfigItem[]> {
    return from(getDoc(doc(this.firestore, 'config/categorias_liturgicas'))).pipe(
      map(snap => {
        if (!snap.exists()) return [];
        const data = snap.data() as { items: ConfigItem[] };
        return data.items?.length ? data.items : [];
      }),
      catchError(() => of([])),
    );
  }

  override getPartesMissa(): Observable<ConfigItem[]> {
    return from(getDoc(doc(this.firestore, 'config/partes_missa'))).pipe(
      map(snap => {
        if (!snap.exists()) return [];
        const data = snap.data() as { items: ConfigItem[] };
        return data.items?.length ? data.items : [];
      }),
      catchError(() => of([])),
    );
  }

  override saveCategorias(items: ConfigItem[]): Observable<void> {
    return from(setDoc(doc(this.firestore, 'config/categorias_liturgicas'), { items })).pipe(
      catchError(err => throwError(() => new Error('Erro ao salvar categorias. Tente novamente.'))),
    );
  }

  override savePartesMissa(items: ConfigItem[]): Observable<void> {
    return from(setDoc(doc(this.firestore, 'config/partes_missa'), { items })).pipe(
      catchError(err => throwError(() => new Error('Erro ao salvar partes da missa. Tente novamente.'))),
    );
  }
}
