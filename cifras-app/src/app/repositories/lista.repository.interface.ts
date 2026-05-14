import { Observable } from 'rxjs';
import { Lista, CategoriaLiturgica, ListasDoDiaResponse } from '../models/lista.model';

export abstract class ListaRepository {
    abstract getListas(): Observable<Lista[]>;
    abstract getListasDodia(data: string): Observable<ListasDoDiaResponse>;
    abstract getListasPorCategoria(cat: CategoriaLiturgica): Observable<Lista[]>;
    abstract getLista(id: string): Observable<Lista | undefined>;
    abstract salvarLista(lista: Lista): Observable<Lista>;
    abstract excluirLista(id: string): Observable<void>;
}
