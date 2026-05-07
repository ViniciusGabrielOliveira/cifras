import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CifraRepository, CifraIndiceItem } from '../repositories/cifra.repository';

export interface ResultadoBusca extends CifraIndiceItem {
  score: number;
  matchTipo: 'titulo' | 'letra' | 'autor';
  trechoMatch?: string;   // trecho da letra onde deu match, para exibir no dropdown
}

/** Normaliza string para comparação: minúsculas + remove acentos */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
 * Bônus: match no início da palavra (+20), match exato (+50)
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
      // Exact title match
      if (tituloNorm === qNorm)
        return { score: 200, matchTipo: 'titulo' };

      // Title starts with query
      if (tituloNorm.startsWith(qNorm))
        return { score: 150, matchTipo: 'titulo' };

      // Title contains query
      if (tituloNorm.includes(qNorm)) {
        const wordStart = /\s/.test(tituloNorm[tituloNorm.indexOf(qNorm) - 1] ?? ' ');
        return { score: wordStart ? 130 : 100, matchTipo: 'titulo' };
      }
  }

  if (filtro === 'tudo' || filtro === 'letra') {
      // Letra contains query
      if (letraNorm.includes(qNorm)) {
        const trecho = extrairTrecho(item.letra, qNorm);
        return { score: 30, matchTipo: 'letra', trechoMatch: trecho };
      }
  }

  if (filtro === 'tudo' || filtro === 'autor') {
      // Autor contains query
      if (autorNorm.includes(qNorm))
        return { score: 10, matchTipo: 'autor' };
  }

  return null;
}

@Injectable({ providedIn: 'root' })
export class CifraBuscaService {
  private repo = inject(CifraRepository);

  /** Busca músicas por query e filtro, retorna até `limit` resultados ordenados por relevância */
  buscar(query: string, limit = 15, filtro: 'tudo' | 'titulo' | 'autor' | 'letra' = 'tudo'): Observable<ResultadoBusca[]> {
    const q = normalizar(query);
    if (q.length < 2) return new Observable(obs => { obs.next([]); obs.complete(); });

    return this.repo.getIndice().pipe(
      map(indice => {
        const resultados: ResultadoBusca[] = [];

        for (const item of indice) {
          const match = calcularScore(item, q, filtro);
          if (match) {
            resultados.push({ ...item, ...match });
          }
        }

        return resultados
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      }),
    );
  }
}
