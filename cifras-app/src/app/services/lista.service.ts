import { Injectable, inject, signal } from '@angular/core';
import { Observable, forkJoin, map, tap } from 'rxjs';
import { Lista, CategoriaLiturgica, Participante, RoleParticipante } from '../models/lista.model';
import { ListaRepository } from '../repositories/lista.repository.interface';

export interface ListaDraftState {
    lista: Lista;
    vista: 'nova-lista' | 'editar-lista';
    parte: string | null;
}

const DRAFT_KEY  = 'cifras__lista_draft';
const VISTA_KEY  = 'cifras__lista_draft_vista';
const PARTE_KEY  = 'cifras__lista_draft_parte';

@Injectable({ providedIn: 'root' })
export class ListaService {
    private repo = inject(ListaRepository);

    readonly assinaturaExpirada = signal(false);

    // ── Draft (estado temporário entre rotas) ────────────────────────

    setDraft(lista: Lista, vista: 'nova-lista' | 'editar-lista', parte?: string | null): void {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(lista));
        sessionStorage.setItem(VISTA_KEY, vista);
        if (parte) sessionStorage.setItem(PARTE_KEY, parte);
        else sessionStorage.removeItem(PARTE_KEY);
    }

    getDraft(): ListaDraftState | null {
        const raw  = sessionStorage.getItem(DRAFT_KEY);
        const vista = sessionStorage.getItem(VISTA_KEY) as 'nova-lista' | 'editar-lista' | null;
        if (!raw || !vista) return null;
        return { lista: JSON.parse(raw) as Lista, vista, parte: sessionStorage.getItem(PARTE_KEY) };
    }

    clearDraft(): void {
        sessionStorage.removeItem(DRAFT_KEY);
        sessionStorage.removeItem(VISTA_KEY);
        sessionStorage.removeItem(PARTE_KEY);
    }

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
