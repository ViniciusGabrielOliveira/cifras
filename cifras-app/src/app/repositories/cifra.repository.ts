import { Observable } from 'rxjs';
import { Cifra } from '../models/cifra.model';

export abstract class CifraRepository {
    abstract getCifra(id: string): Observable<Cifra | undefined>;
    abstract updateCifra(cifra: Cifra): Observable<Cifra>;
    abstract getAllCifras(): Observable<Cifra[]>;
}
