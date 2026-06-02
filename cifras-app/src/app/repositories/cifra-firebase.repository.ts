import { Injectable, inject } from '@angular/core';
import { Observable, from, of, map, catchError, throwError, switchMap } from 'rxjs';
import { FIREBASE_APP } from '../firebase.providers';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from 'firebase/firestore';
import { Cifra, CifraPR, CifraCustom, CifraVersao } from '../models/cifra.model';
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
      catchError(() => of(undefined)),
    );
  }

  override getAllCifras(): Observable<Cifra[]> {
    const cifrasCol = collection(this.firestore, 'cifras');
    return from(getDocs(cifrasCol)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Cifra)),
      catchError(() => of([])),
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
    const indiceItem: CifraIndiceItem = {
      id: cifra.id,
      titulo: cifra.titulo,
      autor: cifra.artista,
      letra: cifra.secoes.flatMap(s => s.linhas.map(l => l.letra)).join(' '),
      categorias: cifra.categorias ?? [],
      partesMissa: cifra.partesMissa ?? [],
    };
    const ops: Promise<any>[] = [setDoc(cifraRef, cifra)];
    if (!cifra.status || cifra.status === 'publica') {
      ops.push(setDoc(doc(this.firestore, `cifras_indice/${cifra.id}`), indiceItem));
    }
    return from(Promise.all(ops)).pipe(
      map(() => cifra),
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao salvar cifra'))),
    );
  }

  override deleteCifra(id: string): Observable<void> {
    const cifraRef = doc(this.firestore, `cifras/${id}`);
    const indiceRef = doc(this.firestore, `cifras_indice/${id}`);
    return from(Promise.all([deleteDoc(cifraRef), deleteDoc(indiceRef)])).pipe(
      map(() => undefined),
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao remover cifra'))),
    );
  }

  // ── Busca por categoria / parte ─────────────────────────────────

  override getCifrasPorCategoria(categoria: string): Observable<Cifra[]> {
    const cifrasCol = collection(this.firestore, 'cifras');
    const q = query(cifrasCol, where('categorias', 'array-contains', categoria));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Cifra)),
      catchError(() => of([])),
    );
  }

  override getCifrasPorParte(parte: string): Observable<Cifra[]> {
    const cifrasCol = collection(this.firestore, 'cifras');
    const q = query(cifrasCol, where('partesMissa', 'array-contains', parte));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Cifra)),
      catchError(() => of([])),
    );
  }

  override getCifrasPorParteOrdenadas(parte: string): Observable<Cifra[]> {
    return this.getCifrasPorParte(parte).pipe(
      map(cifras => cifras.sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0))),
    );
  }

  override getCifrasDoUser(uid: string): Observable<Cifra[]> {
    const q = query(
      collection(this.firestore, 'cifras'),
      where('donoUid', '==', uid),
      where('status', '==', 'privada'),
    );
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as Cifra)),
      catchError(() => of([])),
    );
  }

  private tratarErro(err: unknown, fallback: string): Error {
    const code = (err as any)?.code ?? '';
    if (code === 'permission-denied') return new Error('Sem permissão para realizar esta operação.');
    if (code === 'unavailable') return new Error('Sem conexão com o servidor. Verifique sua internet.');
    return new Error(fallback + '. Tente novamente.');
  }

  override countCifrasDoUser(uid: string): Observable<number> {
    return this.getCifrasDoUser(uid).pipe(map(list => list.length));
  }

  // ── Cifra local da lista (cópia para acesso de participantes) ────

  override salvarCifraEmLista(listaId: string, cifra: Cifra): Observable<void> {
    const ref = doc(this.firestore, `listas/${listaId}/cifras/${cifra.id}`);
    return from(setDoc(ref, cifra)).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  override getCifraEmLista(listaId: string, cifraId: string): Observable<Cifra | undefined> {
    const ref = doc(this.firestore, `listas/${listaId}/cifras/${cifraId}`);
    return from(getDoc(ref)).pipe(
      map(snap => snap.exists() ? { ...snap.data(), id: snap.id } as Cifra : undefined),
      catchError(() => of(undefined)),
    );
  }

  // ── Controle de visibilidade via listas ─────────────────────────

  override atualizarListasIds(cifraId: string, listaId: string, operacao: 'add' | 'remove'): Observable<void> {
    const cifraRef = doc(this.firestore, `cifras/${cifraId}`);
    const op = operacao === 'add' ? arrayUnion(listaId) : arrayRemove(listaId);
    return from(updateDoc(cifraRef, { listasIds: op })).pipe(
      map(() => undefined),
      catchError(() => of(undefined)), // fire-and-forget — não bloqueia fluxo principal
    );
  }

  // ── Pull Requests ────────────────────────────────────────────────

  override criarPR(pr: Omit<CifraPR, 'id'>): Observable<CifraPR> {
    const col = collection(this.firestore, 'cifras_pr');
    console.log('[criarPR] dados enviados:', JSON.parse(JSON.stringify(pr, (_, v) => v === undefined ? '__UNDEFINED__' : v)));
    return from(addDoc(col, pr)).pipe(
      map(ref => ({ ...pr, id: ref.id })),
      catchError(err => {
        console.error('[criarPR] erro raw:', err, 'code:', (err as any)?.code, 'message:', (err as any)?.message);
        return throwError(() => this.tratarErro(err, 'Erro ao criar solicitação'));
      }),
    );
  }

  override getPRsPendentes(): Observable<CifraPR[]> {
    const q = query(collection(this.firestore, 'cifras_pr'), where('status', '==', 'pendente'));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as CifraPR)),
      catchError(() => of([])),
    );
  }

  override getPRsDoUser(uid: string): Observable<CifraPR[]> {
    const q = query(collection(this.firestore, 'cifras_pr'), where('autorUid', '==', uid));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as CifraPR)),
      catchError(() => of([])),
    );
  }

  override getPR(id: string): Observable<CifraPR | undefined> {
    const ref = doc(this.firestore, `cifras_pr/${id}`);
    return from(getDoc(ref)).pipe(
      map(snap => snap.exists() ? { ...snap.data(), id: snap.id } as CifraPR : undefined),
      catchError(() => of(undefined)),
    );
  }

  override resolverPR(prId: string, status: 'aprovado' | 'rejeitado', reviewerUid: string, nota?: string): Observable<void> {
    const ref = doc(this.firestore, `cifras_pr/${prId}`);
    const update: Record<string, unknown> = {
      status,
      reviewerUid,
      resolvidoEm: new Date().toISOString(),
    };
    if (nota) update['reviewerNota'] = nota;
    return from(updateDoc(ref, update)).pipe(
      map(() => undefined),
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao resolver PR'))),
    );
  }

  // ── Versões aprovadas ────────────────────────────────────────────

  override getVersoes(cifraId: string): Observable<CifraVersao[]> {
    const col = collection(this.firestore, `cifras/${cifraId}/versoes`);
    return from(getDocs(col)).pipe(
      map(snap => snap.docs.map(d => ({ ...d.data(), id: d.id }) as CifraVersao)),
      catchError(() => of([])),
    );
  }

  // ── Versões customizadas do usuário ─────────────────────────────

  override salvarCifraCustom(custom: CifraCustom): Observable<CifraCustom> {
    const ref = doc(this.firestore, `cifras_custom/${custom.id}`);
    return from(setDoc(ref, custom)).pipe(
      map(() => custom),
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao salvar versão'))),
    );
  }

  override getCifraCustom(uid: string, cifraId: string): Observable<CifraCustom | undefined> {
    const ref = doc(this.firestore, `cifras_custom/${uid}_${cifraId}`);
    return from(getDoc(ref)).pipe(
      map(snap => snap.exists() ? snap.data() as CifraCustom : undefined),
      catchError(() => of(undefined)),
    );
  }

  salvarVersaoArquivada(cifraId: string, versao: Omit<CifraVersao, 'id'>): Observable<void> {
    const col = collection(this.firestore, `cifras/${cifraId}/versoes`);
    return from(addDoc(col, versao)).pipe(
      map(() => undefined),
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao arquivar versão'))),
    );
  }

  // Reconstrói cifras_indice com categorias e partesMissa de todas as cifras públicas.
  // Usa writeBatch em lotes de 500 (limite do Firestore).
  reindexarIndice(): Observable<{ total: number; atualizadas: number }> {
    return from(getDocs(collection(this.firestore, 'cifras'))).pipe(
      switchMap(async snap => {
        const publicas = snap.docs
          .map(d => ({ ...d.data(), id: d.id }) as Cifra)
          .filter(c => !c.status || c.status === 'publica');

        const BATCH_SIZE = 500;
        for (let i = 0; i < publicas.length; i += BATCH_SIZE) {
          const lote = publicas.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(this.firestore);
          for (const cifra of lote) {
            batch.set(doc(this.firestore, `cifras_indice/${cifra.id}`), {
              id: cifra.id,
              titulo: cifra.titulo,
              autor: cifra.artista,
              letra: cifra.secoes.flatMap(s => s.linhas.map(l => l.letra)).join(' '),
              categorias: cifra.categorias ?? [],
              partesMissa: cifra.partesMissa ?? [],
            });
          }
          await batch.commit();
        }
        return { total: publicas.length, atualizadas: publicas.length };
      }),
      catchError(err => throwError(() => this.tratarErro(err, 'Erro ao reindexar'))),
    );
  }
}
