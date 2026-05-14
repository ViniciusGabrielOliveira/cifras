import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { Lista, CategoriaLiturgica } from '../models/lista.model';
import { ListaRepository } from '../repositories/lista.repository.interface';

@Injectable({ providedIn: 'root' })
export class ListaService {
    private repo = inject(ListaRepository);

    readonly assinaturaExpirada = signal(false);

    // ── Estado temporário de rascunho ────────────────────────────────
    /** Rascunho da lista atual sendo editada, para manter o estado ao navegar para cadastrar cifra */
    listaDraft: Lista | null = null;
    /** Qual era a vista ('nova-lista' ou 'editar-lista') */
    vistaDraft: 'nova-lista' | 'editar-lista' | null = null;
    /** Em qual parte o usuário tinha clicado em "Adicionar" */
    parteParaAdicionarDraft: string | null = null;

    getListas(): Observable<Lista[]> {
        return this.repo.getListas();
    }

    getListasDodia(data: string): Observable<Lista[]> {
        return this.repo.getListasDodia(data).pipe(
            tap(res => this.assinaturaExpirada.set(res.assinaturaExpirada)),
            map(res => res.listas),
        );
    }

    getListasPorCategoria(cat: CategoriaLiturgica): Observable<Lista[]> {
        return this.repo.getListasPorCategoria(cat);
    }

    getLista(id: string): Observable<Lista | undefined> {
        return this.repo.getLista(id);
    }

    salvarLista(lista: Lista): Observable<Lista> {
        return this.repo.salvarLista(lista);
    }

    excluirLista(id: string): Observable<void> {
        return this.repo.excluirLista(id);
    }
}
