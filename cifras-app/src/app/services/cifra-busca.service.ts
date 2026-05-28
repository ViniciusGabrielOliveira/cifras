import { Injectable, inject } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';
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
 *
 * Token único: prioridade título (100-200) > letra (30) > autor (10).
 * Multi-token: cada token deve bater em pelo menos um campo permitido
 * (podem ser campos diferentes). Ex: "gloria eliana" → "gloria" no título
 * e "eliana" no autor. Tokens com menos de 2 caracteres são ignorados.
 */
function calcularScore(item: CifraIndiceItem, qNorm: string, filtro: string): {
  score: number;
  matchTipo: ResultadoBusca['matchTipo'];
  trechoMatch?: string;
} | null {
  const tituloNorm = normalizar(item.titulo ?? '');
  const autorNorm  = normalizar(item.autor ?? '');
  const letraNorm  = normalizar(item.letra ?? '');

  const tokens = qNorm.split(/\s+/).filter(t => t.length >= 2);
  if (tokens.length === 0) return null;

  // Token único — mantém o comportamento preciso original
  if (tokens.length === 1) {
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
        return { score: 30, matchTipo: 'letra', trechoMatch: extrairTrecho(item.letra ?? '', qNorm) };
      }
    }
    if (filtro === 'tudo' || filtro === 'autor') {
      if (autorNorm.includes(qNorm)) return { score: 10, matchTipo: 'autor' };
    }
    return null;
  }

  // Multi-token: cada token deve bater em pelo menos um campo permitido
  let totalScore = 0;
  let matchedTitulo = false;
  let matchedAutor  = false;
  let matchedLetra  = false;

  for (const token of tokens) {
    let tokenScore = 0;

    if (filtro === 'tudo' || filtro === 'titulo') {
      if (tituloNorm.includes(token)) {
        const idx = tituloNorm.indexOf(token);
        const wordStart = /\s/.test(tituloNorm[idx - 1] ?? ' ');
        tokenScore = Math.max(tokenScore, wordStart ? 50 : 30);
        matchedTitulo = true;
      }
    }
    if (filtro === 'tudo' || filtro === 'autor') {
      if (autorNorm.includes(token)) {
        tokenScore = Math.max(tokenScore, 15);
        matchedAutor = true;
      }
    }
    if (filtro === 'tudo' || filtro === 'letra') {
      if (letraNorm.includes(token)) {
        tokenScore = Math.max(tokenScore, 10);
        matchedLetra = true;
      }
    }

    if (tokenScore === 0) return null; // token sem match → descarta
    totalScore += tokenScore;
  }

  const matchTipo: ResultadoBusca['matchTipo'] =
    matchedTitulo ? 'titulo' : matchedAutor ? 'autor' : 'letra';
  const trechoMatch =
    matchedLetra && !matchedTitulo
      ? extrairTrecho(item.letra ?? '', tokens[0])
      : undefined;

  return { score: totalScore, matchTipo, trechoMatch };
}

@Injectable({ providedIn: 'root' })
export class CifraBuscaService {
  private repo = inject(CifraRepository);
  private indice$ = this.repo.getIndice().pipe(shareReplay(1));

  /** Filtra uma lista já carregada — para uso em computed() síncronos. */
  filtrar(
    items: CifraIndiceItem[],
    query: string,
    filtro: 'tudo' | 'titulo' | 'autor' | 'letra' = 'tudo',
  ): ResultadoBusca[] {
    const q = normalizar(query);
    if (q.length < 2) return items.map(i => ({ ...i, score: 0, matchTipo: 'titulo' as const }));
    const resultados: ResultadoBusca[] = [];
    for (const item of items) {
      const match = calcularScore(item, q, filtro);
      if (match) resultados.push({ ...item, ...match });
    }
    return resultados.sort((a, b) => b.score - a.score || (a.titulo ?? '').localeCompare(b.titulo ?? '', 'pt'));
  }

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

    return this.indice$.pipe(
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
          .sort((a, b) => b.score - a.score || (a.titulo ?? '').localeCompare(b.titulo ?? '', 'pt'))
          .slice(0, limit);
      }),
    );
  }
}
