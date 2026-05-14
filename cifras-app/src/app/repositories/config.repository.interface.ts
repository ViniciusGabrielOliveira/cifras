import { Observable } from 'rxjs';
import { ConfigItem } from '../models/config.model';

export abstract class ConfigRepository {
  abstract getCategorias(): Observable<ConfigItem[]>;
  abstract getPartesMissa(): Observable<ConfigItem[]>;
  abstract saveCategorias(items: ConfigItem[]): Observable<void>;
  abstract savePartesMissa(items: ConfigItem[]): Observable<void>;
}
