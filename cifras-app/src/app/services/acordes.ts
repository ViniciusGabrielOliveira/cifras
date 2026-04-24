import { Injectable } from '@angular/core';
import { DiagramaAcorde } from '../models/diagrama.model';

@Injectable({ providedIn: 'root' })
export class AcordesService {
  private DB: Record<string, DiagramaAcorde[]> = {
    'A9': [
      {
        nome: 'A9', variacao: 'Posição 1', casaBase: 1,
        dedos: [
          { corda: 2, casa: 2 },
          { corda: 3, casa: 2 },
          { corda: 4, casa: 2 },
        ],
        cordasMutadas: [], cordasSoltas: [1, 5, 6],
      },
      {
        nome: 'A9', variacao: 'Posição 2', casaBase: 4,
        pestana: 4,
        dedos: [
          { corda: 1, casa: 4 }, { corda: 2, casa: 4 },
          { corda: 3, casa: 4 }, { corda: 4, casa: 4 },
          { corda: 5, casa: 4 }, { corda: 6, casa: 4 },
          { corda: 3, casa: 6 },
        ],
        cordasMutadas: [], cordasSoltas: [],
      },
    ],
    'A9/C#': [
      {
        nome: 'A9/C#', variacao: 'Posição 1', casaBase: 1,
        dedos: [
          { corda: 5, casa: 4 },
          { corda: 2, casa: 2 },
          { corda: 3, casa: 2 },
          { corda: 4, casa: 2 },
        ],
        cordasMutadas: [6], cordasSoltas: [1],
      },
    ],
    'D': [
      {
        nome: 'D', variacao: 'Aberta', casaBase: 1,
        dedos: [
          { corda: 3, casa: 2 },
          { corda: 2, casa: 3 },
          { corda: 1, casa: 2 },
        ],
        cordasMutadas: [5, 6], cordasSoltas: [4],
      },
    ],
    'E': [
      {
        nome: 'E', variacao: 'Aberta', casaBase: 1,
        dedos: [
          { corda: 3, casa: 1 },
          { corda: 5, casa: 2 },
          { corda: 4, casa: 2 },
        ],
        cordasMutadas: [], cordasSoltas: [1, 2, 6],
      },
    ],
    'Bm': [
      {
        nome: 'Bm', variacao: 'Pestana 2ª', casaBase: 2,
        pestana: 2,
        dedos: [
          { corda: 1, casa: 2 }, { corda: 2, casa: 2 },
          { corda: 3, casa: 2 }, { corda: 4, casa: 2 },
          { corda: 5, casa: 2 }, { corda: 6, casa: 2 },
          { corda: 4, casa: 4 },
          { corda: 3, casa: 4 },
          { corda: 2, casa: 3 },
        ],
        cordasMutadas: [], cordasSoltas: [],
      },
    ],
    'F#m': [
      {
        nome: 'F#m', variacao: 'Pestana 2ª', casaBase: 2,
        pestana: 2,
        dedos: [
          { corda: 1, casa: 2 }, { corda: 2, casa: 2 },
          { corda: 3, casa: 2 }, { corda: 4, casa: 2 },
          { corda: 5, casa: 2 }, { corda: 6, casa: 2 },
          { corda: 4, casa: 4 },
          { corda: 3, casa: 4 },
        ],
        cordasMutadas: [], cordasSoltas: [],
      },
    ],
    'G': [
      {
        nome: 'G', variacao: 'Aberta', casaBase: 1,
        dedos: [
          { corda: 6, casa: 3 },
          { corda: 5, casa: 2 },
          { corda: 1, casa: 3 },
        ],
        cordasMutadas: [], cordasSoltas: [2, 3, 4],
      },
    ],
    'A': [
      {
        nome: 'A', variacao: 'Aberta', casaBase: 1,
        dedos: [
          { corda: 4, casa: 2 },
          { corda: 3, casa: 2 },
          { corda: 2, casa: 2 },
        ],
        cordasMutadas: [6], cordasSoltas: [1, 5],
      },
    ],
    'E/G#': [
      {
        nome: 'E/G#', variacao: 'Posição 1', casaBase: 1,
        dedos: [
          { corda: 6, casa: 4 },
          { corda: 3, casa: 1 },
          { corda: 5, casa: 2 },
          { corda: 4, casa: 2 },
        ],
        cordasMutadas: [], cordasSoltas: [1, 2],
      },
    ],
  };

  getVariacoes(acorde: string): DiagramaAcorde[] {
    return this.DB[acorde] ?? [];
  }
}
