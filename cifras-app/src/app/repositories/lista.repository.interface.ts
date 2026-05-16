import { Observable } from 'rxjs';
import { Lista, CategoriaLiturgica, ListasDoDiaResponse, Participante, RoleParticipante } from '../models/lista.model';

export abstract class ListaRepository {
    abstract getListas(): Observable<Lista[]>;
    abstract getListasDodia(data: string): Observable<ListasDoDiaResponse>;
    abstract getListasPorCategoria(cat: CategoriaLiturgica): Observable<Lista[]>;
    abstract getLista(id: string): Observable<Lista | undefined>;
    abstract salvarLista(lista: Lista): Observable<Lista>;
    abstract excluirLista(id: string): Observable<void>;
    // Listas privadas do usuário
    abstract getMinhasListas(uid: string): Observable<Lista[]>;
    abstract getListasComoParticipante(uid: string): Observable<Lista[]>;
    abstract getListaPorToken(token: string): Observable<Lista | undefined>;
    abstract adicionarParticipante(listaId: string, participante: Participante): Observable<void>;
    abstract removerParticipante(listaId: string, uid: string): Observable<void>;
    abstract atualizarRoleParticipante(listaId: string, uid: string, role: RoleParticipante): Observable<void>;
    abstract atualizarControladoresUids(listaId: string, uids: string[]): Observable<void>;
}
