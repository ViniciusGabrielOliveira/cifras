import { Observable } from 'rxjs';
import { Cifra } from '../models/cifra.model';

export interface CifraIndiceItem {
  id: string;
  titulo: string;
  autor: string;
  letra: string;
}

export abstract class CifraRepository {
  abstract getCifra(id: string): Observable<Cifra | undefined>;
  abstract updateCifra(cifra: Cifra): Observable<Cifra>;
  abstract deleteCifra(id: string): Observable<void>;
  abstract getAllCifras(): Observable<Cifra[]>;
  abstract getIndice(): Observable<CifraIndiceItem[]>;
  abstract getCifrasPorCategoria(categoria: string): Observable<Cifra[]>;
  abstract getCifrasPorParte(parte: string): Observable<Cifra[]>;
}
