import { Injectable, inject, signal } from '@angular/core';
import { Observable, forkJoin, map, tap } from 'rxjs';
import { Lista, CategoriaLiturgica, Participante, RoleParticipante } from '../models/lista.model';
import { ListaRepository } from '../repositories/lista.repository.interface';

@Injectable({ providedIn: 'root' })
export class ListaService {
    private repo = inject(ListaRepository);

    readonly assinaturaExpirada = signal(false);

    listaDraft: Lista | null = null;
    vistaDraft: 'nova-lista' | 'editar-lista' | null = null;
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

    escutarLista(id: string): Observable<Lista | undefined> {
        return this.repo.escutarLista(id);
    }

    salvarLista(lista: Lista): Observable<Lista> {
        return this.repo.salvarLista(lista);
    }

    excluirLista(id: string): Observable<void> {
        return this.repo.excluirLista(id);
    }

    // ── Listas privadas ──────────────────────────────────────────────

    getMinhasListas(uid: string): Observable<Lista[]> {
        return this.repo.getMinhasListas(uid);
    }

    getListasComoParticipante(uid: string): Observable<Lista[]> {
        return this.repo.getListasComoParticipante(uid);
    }

    getTodasMinhasListas(uid: string): Observable<Lista[]> {
        return forkJoin([
            this.repo.getMinhasListas(uid),
            this.repo.getListasComoParticipante(uid),
        ]).pipe(map(([proprias, participando]) => [...proprias, ...participando]));
    }

    getListaPorToken(token: string): Observable<Lista | undefined> {
        return this.repo.getListaPorToken(token);
    }

    adicionarParticipante(listaId: string, participante: Participante): Observable<void> {
        return this.repo.adicionarParticipante(listaId, participante);
    }

    removerParticipante(listaId: string, uid: string): Observable<void> {
        return this.repo.removerParticipante(listaId, uid);
    }

    atualizarRoleParticipante(listaId: string, uid: string, role: RoleParticipante): Observable<void> {
        return this.repo.atualizarRoleParticipante(listaId, uid, role);
    }

    atualizarControladoresUids(listaId: string, uids: string[]): Observable<void> {
        return this.repo.atualizarControladoresUids(listaId, uids);
    }
}
