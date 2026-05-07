import { Observable } from 'rxjs';
import { DiagramaAcorde } from '../models/diagrama.model';

export abstract class AcordeRepository {
  /**
   * Busca as variações de um ou mais acordes.
   * Retorna um mapa onde a chave é o nome do acorde.
   */
  abstract getAcordes(nomes: string[]): Observable<Record<string, DiagramaAcorde[]>>;
}
