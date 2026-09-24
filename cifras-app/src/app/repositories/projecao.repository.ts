import { Injectable, inject } from '@angular/core';
import { collection, doc, getDoc, getDocs, getFirestore, setDoc, runTransaction } from 'firebase/firestore';
import { FIREBASE_APP } from '../firebase.providers';
import { ListaProjecao } from '../models/projecao.model';
import { LayoutProjecao, normalizarLayout } from '../models/layout-projecao.model';

@Injectable({ providedIn: 'root' })
export class ProjecaoRepository {
  private readonly db = getFirestore(inject(FIREBASE_APP));

  async obterLayout(uid: string): Promise<LayoutProjecao> {
    const resultado = await getDoc(doc(this.db, 'users', uid, 'preferencias', 'projecao'));
    return normalizarLayout(resultado.data());
  }

  salvarLayout(uid: string, layout: LayoutProjecao): Promise<void> {
    return setDoc(doc(this.db, 'users', uid, 'preferencias', 'projecao'), normalizarLayout(layout));
  }

  async listarLegadas(uid: string): Promise<string[]> {
    const resultado = await getDocs(collection(this.db, 'users', uid, 'listasProjecao'));
    return resultado.docs.filter(item => !item.data()['listaMigradaId']).map(item => item.id);
  }

  /** Migra atomicamente; mantém o original como histórico e evita duplicações. */
  async migrarLegada(uid: string, id: string, donoNome: string): Promise<string | undefined> {
    const origem = doc(this.db, 'users', uid, 'listasProjecao', id);
    const destino = doc(collection(this.db, 'listas'));
    return runTransaction(this.db, async transaction => {
      const antiga = await transaction.get(origem);
      if (!antiga.exists()) return undefined;
      const dados = antiga.data();
      if (typeof dados['listaMigradaId'] === 'string') return dados['listaMigradaId'];
      const lista = dados as ListaProjecao;
      const agora = new Date().toISOString();
      transaction.set(destino, {
        titulo: lista.titulo, tipo: 'privada', donoUid: uid, donoNome,
        participantes: [], participantesUids: [], partes: [{ id: 'projecao', label: 'Repertório' }],
        musicas: lista.musicas.map((musica, ordem) => ({ ...musica, parte: 'projecao', ordem })),
        criadaEm: agora, atualizadaEm: lista.atualizadaEm || agora,
      });
      transaction.update(origem, { listaMigradaId: destino.id });
      return destino.id;
    });
  }
}
