import { Observable } from 'rxjs';
import { Cifra, CifraPR, CifraCustom, CifraVersao } from '../models/cifra.model';

export interface CifraIndiceItem {
  id: string;
  titulo: string;
  autor: string;
  letra: string;
  categorias?: string[];
  partesMissa?: string[];
}

export abstract class CifraRepository {
  abstract getCifra(id: string): Observable<Cifra | undefined>;
  abstract updateCifra(cifra: Cifra): Observable<Cifra>;
  abstract deleteCifra(id: string): Observable<void>;
  abstract getAllCifras(): Observable<Cifra[]>;
  abstract getIndice(): Observable<CifraIndiceItem[]>;
  abstract getCifrasPorCategoria(categoria: string): Observable<Cifra[]>;
  abstract getCifrasPorParte(parte: string): Observable<Cifra[]>;
  abstract getCifrasPorParteOrdenadas(parte: string): Observable<Cifra[]>;
  // Cifras privadas do usuário
  abstract getCifrasDoUser(uid: string): Observable<Cifra[]>;
  abstract countCifrasDoUser(uid: string): Observable<number>;
  // Todas as cifras privadas (admin)
  abstract getCifrasPrivadas(): Observable<Cifra[]>;
  // Controle de visibilidade via listas
  abstract atualizarListasIds(cifraId: string, listaId: string, operacao: 'add' | 'remove'): Observable<void>;
  // Cópia da cifra dentro da lista (acesso garantido a participantes)
  abstract salvarCifraEmLista(listaId: string, cifra: Cifra): Observable<void>;
  abstract getCifraEmLista(listaId: string, cifraId: string): Observable<Cifra | undefined>;
  // Pull Requests
  abstract criarPR(pr: Omit<CifraPR, 'id'>): Observable<CifraPR>;
  abstract getPRsPendentes(): Observable<CifraPR[]>;
  abstract getPRsDoUser(uid: string): Observable<CifraPR[]>;
  abstract getPR(id: string): Observable<CifraPR | undefined>;
  abstract resolverPR(prId: string, status: 'aprovado' | 'rejeitado', reviewerUid: string, nota?: string): Observable<void>;
  // Versões aprovadas
  abstract getVersoes(cifraId: string): Observable<CifraVersao[]>;
  abstract salvarVersaoArquivada(cifraId: string, versao: Omit<CifraVersao, 'id'>): Observable<void>;
  // Versões customizadas do usuário
  abstract salvarCifraCustom(custom: CifraCustom): Observable<CifraCustom>;
  abstract getCifraCustom(uid: string, cifraId: string): Observable<CifraCustom | undefined>;
  // Administração
  abstract reindexarIndice(): Observable<{ total: number; atualizadas: number }>;
}
