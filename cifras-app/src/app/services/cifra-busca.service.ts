import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { CifraRepository, CifraIndiceItem } from '../repositories/cifra.repository.interface';

export interface ResultadoBusca extends CifraIndiceItem {
  score: number;
  matchTipo: 'titulo' | 'letra' | 'autor';
  trechoMatch?: string;
}

/** Normaliza string para comparação: minúsculas + remove acentos */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Retorna um trecho ao redor do match na letra (para preview) */
function extrairTrecho(letra: string, query: string, maxLen = 60): string {
  const idx = normalizar(letra).indexOf(normalizar(query));
  if (idx === -1) return '';
  const start = Math.max(0, idx - 15);
  const end   = Math.min(letra.length, idx + query.length + 30);
  let trecho  = letra.slice(start, end).replace(/\n/g, ' ');
  if (start > 0) trecho = '...' + trecho;
  if (end < letra.length) trecho += '...';
  return trecho.length > maxLen ? trecho.slice(0, maxLen) + '…' : trecho;
}

/**
 * Calcula score de relevância para um item dado uma query.
 * Prioridade: título (100) > letra (30) > autor (10)
 */
function calcularScore(item: CifraIndiceItem, qNorm: string, filtro: string): {
  score: number;
  matchTipo: ResultadoBusca['matchTipo'];
  trechoMatch?: string;
} | null {
  const tituloNorm = normalizar(item.titulo);
  const autorNorm  = normalizar(item.autor);
  const letraNorm  = normalizar(item.letra);

  if (filtro === 'tudo' || filtro === 'titulo') {
    if (tituloNorm === qNorm) return { score: 200, matchTipo: 'titulo' };
    if (tituloNorm.startsWith(qNorm)) return { score: 150, matchTipo: 'titulo' };
    if (tituloNorm.includes(qNorm)) {
      const wordStart = /\s/.test(tituloNorm[tituloNorm.indexOf(qNorm) - 1] ?? ' ');
      return { score: wordStart ? 130 : 100, matchTipo: 'titulo' };
    }
  }

  if (filtro === 'tudo' || filtro === 'letra') {
    if (letraNorm.includes(qNorm)) {
      return { score: 30, matchTipo: 'letra', trechoMatch: extrairTrecho(item.letra, qNorm) };
    }
  }

  if (filtro === 'tudo' || filtro === 'autor') {
    if (autorNorm.includes(qNorm)) return { score: 10, matchTipo: 'autor' };
  }

  return null;
}

@Injectable({ providedIn: 'root' })
export class CifraBuscaService {
  private repo = inject(CifraRepository);

  buscar(
    query: string,
    limit = 15,
    filtro: 'tudo' | 'titulo' | 'autor' | 'letra' = 'tudo',
    filtrosCategorias: string[] = [],
    filtrosPartes: string[] = [],
  ): Observable<ResultadoBusca[]> {
    const q = normalizar(query);
    const hasText   = q.length >= 2;
    const hasCats   = filtrosCategorias.length > 0;
    const hasPartes = filtrosPartes.length > 0;

    if (!hasText && !hasCats && !hasPartes) {
      return of([]);
    }

    return this.repo.getIndice().pipe(
      map(indice => {
        const resultados: ResultadoBusca[] = [];

        for (const item of indice) {
          if (hasCats && !filtrosCategorias.some(c => item.categorias?.includes(c))) continue;
          if (hasPartes && !filtrosPartes.some(p => item.partesMissa?.includes(p))) continue;

          if (hasText) {
            const match = calcularScore(item, q, filtro);
            if (match) resultados.push({ ...item, ...match });
          } else {
            resultados.push({ ...item, score: 0, matchTipo: 'titulo' });
          }
        }

        return resultados
          .sort((a, b) => b.score - a.score || a.titulo.localeCompare(b.titulo, 'pt'))
          .slice(0, limit);
      }),
    );
  }
}
