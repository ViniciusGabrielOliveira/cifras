import { Injectable, inject } from '@angular/core';
import { Observable, from, map, switchMap, catchError, throwError, of } from 'rxjs';
import { FIREBASE_APP } from '../firebase.providers';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  addDoc,
} from 'firebase/firestore';
import { Lista, CategoriaLiturgica, ListasDoDiaResponse, Participante, RoleParticipante } from '../models/lista.model';
import { ListaRepository } from './lista.repository.interface';

@Injectable()
export class ListaFirebaseRepository extends ListaRepository {
  private app = inject(FIREBASE_APP);
  private firestore = getFirestore(this.app);

  override getListas(): Observable<Lista[]> {
    const listasCol = collection(this.firestore, 'listas');
    return from(getDocs(listasCol)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Lista)),
      catchError(() => of([])),
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
      catchError(() => of({ listas: [], assinaturaExpirada: false })),
    );
  }

  override getListasPorCategoria(cat: CategoriaLiturgica): Observable<Lista[]> {
    const listasCol = collection(this.firestore, 'listas');
    const q = query(listasCol, where('categoria', '==', cat));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Lista)),
      catchError(() => of([])),
    );
  }

  override getLista(id: string): Observable<Lista | undefined> {
    const listaRef = doc(this.firestore, `listas/${id}`);
    return from(getDoc(listaRef)).pipe(
      map(snap => snap.exists() ? { ...snap.data(), id: snap.id } as Lista : undefined),
      catchError(() => of(undefined)),
    );
  }

  override salvarLista(lista: Lista): Observable<Lista> {
    if (lista.id) {
      const listaRef = doc(this.firestore, `listas/${lista.id}`);
      const now = new Date().toISOString();
      const data = { ...lista, atualizadaEm: now };
      return from(setDoc(listaRef, data)).pipe(
        map(() => data),
        catchError(err => throwError(() => this.tratarErro(err, 'Erro ao salvar lista'))),
      );
    }

    const listasCol = collection(this.firestore, 'listas');
    const now = new Date().toISOString();
    const { id: _id, ...rest } = lista;
    const data = { ...rest, criadaEm: now, atualizadaEm: now };
    return from(addDoc(listasCol, data)).pipe(
      map(ref => ({ ...data, id: ref.id } as Lista)),
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao criar lista'))),
    );
  }

  override excluirLista(id: string): Observable<void> {
    const listaRef = doc(this.firestore, `listas/${id}`);
    return from(deleteDoc(listaRef)).pipe(
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao excluir lista'))),
    );
  }

  override getMinhasListas(uid: string): Observable<Lista[]> {
    const q = query(
      collection(this.firestore, 'listas'),
      where('donoUid', '==', uid),
      where('tipo', '==', 'privada'),
    );
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Lista)),
      catchError(() => of([])),
    );
  }

  override getListasComoParticipante(uid: string): Observable<Lista[]> {
    const q = query(
      collection(this.firestore, 'listas'),
      where('participantesUids', 'array-contains', uid),
    );
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Lista)),
      catchError(() => of([])),
    );
  }

  override getListaPorToken(token: string): Observable<Lista | undefined> {
    const q = query(
      collection(this.firestore, 'listas'),
      where('tokenConvite', '==', token),
      where('tipo', '==', 'privada'),
    );
    return from(getDocs(q)).pipe(
      map(snap => snap.empty ? undefined : { ...snap.docs[0].data(), id: snap.docs[0].id } as Lista),
      catchError(() => of(undefined)),
    );
  }

  override adicionarParticipante(listaId: string, participante: Participante): Observable<void> {
    const ref = doc(this.firestore, `listas/${listaId}`);
    return from(updateDoc(ref, {
      participantes: arrayUnion(participante),
      participantesUids: arrayUnion(participante.uid),
    })).pipe(
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao adicionar participante'))),
    );
  }

  override removerParticipante(listaId: string, uid: string): Observable<void> {
    const ref = doc(this.firestore, `listas/${listaId}`);
    return from(getDoc(ref)).pipe(
      switchMap(snap => {
        if (!snap.exists()) return of(undefined as void);
        const participantes = ((snap.data() as Lista).participantes ?? []).filter(p => p.uid !== uid);
        return from(updateDoc(ref, {
          participantes,
          participantesUids: arrayRemove(uid),
        })).pipe(map(() => undefined as void));
      }),
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao remover participante'))),
    );
  }

  override atualizarRoleParticipante(listaId: string, uid: string, role: RoleParticipante): Observable<void> {
    const ref = doc(this.firestore, `listas/${listaId}`);
    return from(getDoc(ref)).pipe(
      switchMap(snap => {
        if (!snap.exists()) return of(undefined as void);
        const participantes = ((snap.data() as Lista).participantes ?? []).map(p =>
          p.uid === uid ? { ...p, role } : p,
        );
        return from(updateDoc(ref, { participantes })).pipe(map(() => undefined as void));
      }),
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao atualizar participante'))),
    );
  }

  override atualizarControladoresUids(listaId: string, uids: string[]): Observable<void> {
    const ref = doc(this.firestore, `listas/${listaId}`);
    return from(updateDoc(ref, { controladoresUids: uids })).pipe(
      map(() => undefined as void),
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao atualizar controladores'))),
    );
  }

  private tratarErro(err: unknown, fallback: string): Error {
    if (err instanceof Error) {
      if (err.message.includes('permission') || (err as any).code === 'permission-denied') {
        return new Error('Sem permissão para realizar esta operação.');
      }
      if (err.message.includes('network') || (err as any).code === 'unavailable') {
        return new Error('Sem conexão com o servidor. Verifique sua internet.');
      }
    }
    return new Error(fallback + '. Tente novamente.');
  }
}
