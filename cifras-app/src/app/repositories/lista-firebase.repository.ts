import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { FIREBASE_APP } from '../firebase.providers';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  addDoc,
} from 'firebase/firestore';
import { Lista, CategoriaLiturgica, ListasDoDiaResponse } from '../models/lista.model';
import { ListaRepository } from './lista.repository.interface';

@Injectable()
export class ListaFirebaseRepository extends ListaRepository {
  private app = inject(FIREBASE_APP);
  private firestore = getFirestore(this.app);

  override getListas(): Observable<Lista[]> {
    const listasCol = collection(this.firestore, 'listas');
    return from(getDocs(listasCol)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Lista)),
    );
  }

  override getListasDodia(data: string): Observable<ListasDoDiaResponse> {
    const listasCol = collection(this.firestore, 'listas');
    const q = query(listasCol, where('data', '==', data));
    return from(getDocs(q)).pipe(
      map(snap => ({
        listas: snap.docs.map(d => ({ ...d.data(), id: d.id }) as Lista),
        assinaturaExpirada: false,
      })),
    );
  }

  override getListasPorCategoria(cat: CategoriaLiturgica): Observable<Lista[]> {
    const listasCol = collection(this.firestore, 'listas');
    const q = query(listasCol, where('categoria', '==', cat));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Lista)),
    );
  }

  override getLista(id: string): Observable<Lista | undefined> {
    const listaRef = doc(this.firestore, `listas/${id}`);
    return from(getDoc(listaRef)).pipe(
      map(snap => snap.exists() ? { ...snap.data(), id: snap.id } as Lista : undefined),
    );
  }

  override salvarLista(lista: Lista): Observable<Lista> {
    if (lista.id) {
      // Atualiza existente
      const listaRef = doc(this.firestore, `listas/${lista.id}`);
      const now = new Date().toISOString();
      const data = { ...lista, atualizadaEm: now };
      return from(setDoc(listaRef, data)).pipe(map(() => data));
    }

    // Cria nova lista
    const listasCol = collection(this.firestore, 'listas');
    const now = new Date().toISOString();
    const data = { ...lista, criadaEm: now, atualizadaEm: now };
    return from(addDoc(listasCol, data)).pipe(
      map(ref => ({ ...data, id: ref.id })),
    );
  }

  override excluirLista(id: string): Observable<void> {
    const listaRef = doc(this.firestore, `listas/${id}`);
    return from(deleteDoc(listaRef));
  }
}
