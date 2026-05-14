import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ConfigItem } from '../models/config.model';
import { ConfigRepository } from './config.repository.interface';

@Injectable()
export class ConfigMockRepository extends ConfigRepository {
  override getCategorias(): Observable<ConfigItem[]> {
    return of([]);
  }

  override getPartesMissa(): Observable<ConfigItem[]> {
    return of([]);
  }

  override saveCategorias(_items: ConfigItem[]): Observable<void> {
    return of(undefined);
  }

  override savePartesMissa(_items: ConfigItem[]): Observable<void> {
    return of(undefined);
  }
}
