import { Injectable, inject } from '@angular/core';
import { Observable, from, of, map } from 'rxjs';
import { FIREBASE_APP } from '../firebase.providers';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { Cifra } from '../models/cifra.model';
import { CifraRepository, CifraIndiceItem } from './cifra.repository.interface';

@Injectable()
export class CifraFirebaseRepository extends CifraRepository {
  private app = inject(FIREBASE_APP);
  private firestore = getFirestore(this.app);

  // ── Leitura ─────────────────────────────────────────────────────

  override getCifra(id: string): Observable<Cifra | undefined> {
    const cifraRef = doc(this.firestore, `cifras/${id}`);
    return from(getDoc(cifraRef)).pipe(
      map(snap => snap.exists() ? { ...snap.data(), id: snap.id } as Cifra : undefined),
    );
  }

  override getAllCifras(): Observable<Cifra[]> {
    const cifrasCol = collection(this.firestore, 'cifras');
    return from(getDocs(cifrasCol)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Cifra)),
    );
  }

  override getIndice(): Observable<CifraIndiceItem[]> {
    const indiceCol = collection(this.firestore, 'cifras_indice');
    return new Observable<CifraIndiceItem[]>(subscriber => {
      const unsubscribe = onSnapshot(indiceCol,
        snap => {
          const items = snap.docs.map(d => ({ ...d.data(), id: d.id }) as CifraIndiceItem);
          subscriber.next(items);
        },
        err => subscriber.error(err),
      );
      return () => unsubscribe();
    });
  }

  // ── Escrita ─────────────────────────────────────────────────────

  override updateCifra(cifra: Cifra): Observable<Cifra> {
    const cifraRef = doc(this.firestore, `cifras/${cifra.id}`);
    const indiceRef = doc(this.firestore, `cifras_indice/${cifra.id}`);

    const indiceItem: CifraIndiceItem = {
      id: cifra.id,
      titulo: cifra.titulo,
      autor: cifra.artista,
      letra: cifra.secoes.flatMap(s => s.linhas.map(l => l.letra)).join(' '),
    };

    return from(
      Promise.all([
        setDoc(cifraRef, cifra),
        setDoc(indiceRef, indiceItem),
      ])
    ).pipe(map(() => cifra));
  }

  override deleteCifra(id: string): Observable<void> {
    const cifraRef = doc(this.firestore, `cifras/${id}`);
    const indiceRef = doc(this.firestore, `cifras_indice/${id}`);
    return from(Promise.all([deleteDoc(cifraRef), deleteDoc(indiceRef)])).pipe(
      map(() => undefined),
    );
  }

  // ── Busca por categoria / parte ─────────────────────────────────

  override getCifrasPorCategoria(categoria: string): Observable<Cifra[]> {
    const cifrasCol = collection(this.firestore, 'cifras');
    const q = query(cifrasCol, where('categorias', 'array-contains', categoria));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Cifra)),
    );
  }

  override getCifrasPorParte(parte: string): Observable<Cifra[]> {
    const cifrasCol = collection(this.firestore, 'cifras');
    const q = query(cifrasCol, where('partesMissa', 'array-contains', parte));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Cifra)),
    );
  }
}
