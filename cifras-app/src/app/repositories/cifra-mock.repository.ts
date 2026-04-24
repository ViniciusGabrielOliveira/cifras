import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from, switchMap, tap, map } from 'rxjs';
import { Cifra } from '../models/cifra.model';
import { CifraRepository } from './cifra.repository';

const LS_PREFIX = 'cifras_mock_';

@Injectable({ providedIn: 'root' })
export class CifraMockRepository extends CifraRepository {
    private http = inject(HttpClient);

    /** Cache em memória para esta sessão */
    private cache = new Map<string, Cifra>();

    override getCifra(id: string): Observable<Cifra | undefined> {
        // 1. Verifica cache em memória
        if (this.cache.has(id)) {
            return of(this.cache.get(id));
        }

        // 2. Verifica localStorage (edições salvas)
        const lsKey = LS_PREFIX + id;
        const saved = localStorage.getItem(lsKey);
        if (saved) {
            try {
                const cifra: Cifra = JSON.parse(saved);
                this.cache.set(id, cifra);
                return of(cifra);
            } catch {
                localStorage.removeItem(lsKey);
            }
        }

        // 3. Carrega do JSON asset
        return this.http.get<Cifra>(`data/${id}.json`).pipe(
            tap(cifra => this.cache.set(id, cifra)),
        );
    }

    override updateCifra(cifra: Cifra): Observable<Cifra> {
        // Atualiza cache em memória
        this.cache.set(cifra.id, cifra);

        // Persiste no localStorage
        const lsKey = LS_PREFIX + cifra.id;
        localStorage.setItem(lsKey, JSON.stringify(cifra, null, 2));

        return of(cifra);
    }

    override getAllCifras(): Observable<Cifra[]> {
        return this.getCifra('harpa-crista-porque-ele-vive').pipe(
            map(c => (c ? [c] : [])),
        );
    }

    /** Exporta o JSON atual para download */
    exportJSON(id: string): void {
        const cifra = this.cache.get(id);
        if (!cifra) return;
        const blob = new Blob([JSON.stringify(cifra, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /** Retorna o JSON atual como string (para copiar) */
    getJSON(id: string): string {
        const cifra = this.cache.get(id);
        return cifra ? JSON.stringify(cifra, null, 2) : '';
    }

    /** Reseta para o JSON original (remove do localStorage) */
    resetToOriginal(id: string): Observable<Cifra | undefined> {
        localStorage.removeItem(LS_PREFIX + id);
        this.cache.delete(id);
        return this.getCifra(id);
    }
}
