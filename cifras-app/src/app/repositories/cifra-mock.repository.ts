import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, map, shareReplay, BehaviorSubject } from 'rxjs';
import { Cifra } from '../models/cifra.model';
import { CifraRepository, CifraIndiceItem } from './cifra.repository.interface';

const LS_PREFIX = 'cifras_mock_';

@Injectable({ providedIn: 'root' })
export class CifraMockRepository extends CifraRepository {
    private http = inject(HttpClient);

    /** Cache em memória para esta sessão */
    private cache = new Map<string, Cifra>();
    
    private indiceLoaded = false;
    private indiceSubject = new BehaviorSubject<CifraIndiceItem[]>([]);

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

        // Atualiza o índice de busca
        if (this.indiceLoaded) {
            const current = this.indiceSubject.value;
            const newItem: CifraIndiceItem = {
                id: cifra.id,
                titulo: cifra.titulo,
                autor: cifra.artista,
                letra: cifra.secoes.flatMap(s => s.linhas.map(l => l.letra)).join(' ')
            };
            const idx = current.findIndex(x => x.id === cifra.id);
            if (idx >= 0) {
                current[idx] = newItem;
            } else {
                current.push(newItem);
            }
            this.indiceSubject.next([...current]);
        }

        return of(cifra);
    }

    override deleteCifra(id: string): Observable<void> {
        this.cache.delete(id);
        localStorage.removeItem(LS_PREFIX + id);
        if (this.indiceLoaded) {
            const updated = this.indiceSubject.value.filter(x => x.id !== id);
            this.indiceSubject.next(updated);
        }
        return of(undefined);
    }

    override getAllCifras(): Observable<Cifra[]> {
        return this.getCifra('harpa-crista-porque-ele-vive').pipe(
            map(c => (c ? [c] : [])),
        );
    }

    override getIndice(): Observable<CifraIndiceItem[]> {
        if (!this.indiceLoaded) {
            this.indiceLoaded = true;
            this.http.get<CifraIndiceItem[]>('data/indice.json').subscribe({
                next: (baseIndex) => {
                    const localIndex = this.carregarIndiceLocal();
                    const indexMap = new Map<string, CifraIndiceItem>();
                    baseIndex.forEach(item => indexMap.set(item.id, item));
                    localIndex.forEach(item => indexMap.set(item.id, item));
                    this.indiceSubject.next(Array.from(indexMap.values()));
                },
                error: () => {
                    this.indiceSubject.next(this.carregarIndiceLocal());
                }
            });
        }
        return this.indiceSubject.asObservable();
    }

    private carregarIndiceLocal(): CifraIndiceItem[] {
        const items: CifraIndiceItem[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(LS_PREFIX)) {
                try {
                    const cifra: Cifra = JSON.parse(localStorage.getItem(key)!);
                    items.push({
                        id: cifra.id,
                        titulo: cifra.titulo,
                        autor: cifra.artista,
                        letra: cifra.secoes.flatMap(s => s.linhas.map(l => l.letra)).join(' ')
                    });
                } catch {}
            }
        }
        return items;
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

    override getCifrasPorCategoria(categoria: string): Observable<Cifra[]> {
        return this.getAllCifras().pipe(
            map(cifras => cifras.filter(c => c.categorias?.includes(categoria))),
        );
    }

    override getCifrasPorParte(parte: string): Observable<Cifra[]> {
        return this.getAllCifras().pipe(
            map(cifras => cifras.filter(c => c.partesMissa?.includes(parte))),
        );
    }
}
