import { Injectable, inject, signal, computed } from '@angular/core';
import { forkJoin, firstValueFrom, tap } from 'rxjs';
import { ConfigItem } from '../models/config.model';
import { ConfigRepository } from '../repositories/config.repository.interface';

const DEFAULT_CATEGORIAS: ConfigItem[] = [
  { id: 'tempo-comum', label: 'Tempo Comum', ordem: 0 },
  { id: 'advento', label: 'Advento', ordem: 1 },
  { id: 'quaresma', label: 'Quaresma', ordem: 2 },
  { id: 'pascoa', label: 'Páscoa', ordem: 3 },
  { id: 'festas-liturgicas', label: 'Festas Litúrgicas', ordem: 4 },
  { id: 'sem-categoria', label: 'Sem Categoria', ordem: 99 },
];

const DEFAULT_PARTES: ConfigItem[] = [
  { id: 'entrada', label: 'Entrada', ordem: 0 },
  { id: 'ato-penitencial', label: 'Ato Penitencial', ordem: 1 },
  { id: 'gloria', label: 'Glória', ordem: 2 },
  { id: 'salmo', label: 'Salmo', ordem: 3 },
  { id: 'ofertorio', label: 'Ofertório', ordem: 4 },
  { id: 'santo', label: 'Santo', ordem: 5 },
  { id: 'comunhao', label: 'Comunhão', ordem: 6 },
  { id: 'final', label: 'Final', ordem: 7 },
];

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private repo = inject(ConfigRepository);

  private _categorias = signal<ConfigItem[]>(DEFAULT_CATEGORIAS);
  private _partes = signal<ConfigItem[]>(DEFAULT_PARTES);
  private _loaded = signal(false);

  readonly categorias = this._categorias.asReadonly();
  readonly partesMissa = this._partes.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly categoriasLabels = computed(() => {
    const map: Record<string, string> = {};
    for (const c of this._categorias()) map[c.id] = c.label;
    return map;
  });

  readonly partesLabels = computed(() => {
    const map: Record<string, string> = {};
    for (const p of this._partes()) map[p.id] = p.label;
    return map;
  });

  readonly categoriasIds = computed(() =>
    this._categorias().sort((a, b) => a.ordem - b.ordem).map(c => c.id)
  );

  readonly partesIds = computed(() =>
    this._partes().sort((a, b) => a.ordem - b.ordem).map(p => p.id)
  );

  constructor() {
    this.carregarConfig();
  }

  private carregarConfig() {
    forkJoin([this.repo.getCategorias(), this.repo.getPartesMissa()]).subscribe({
      next: ([cats, partes]) => {
        if (cats.length) this._categorias.set(cats);
        if (partes.length) this._partes.set(partes);
      },
      error: () => {},
      complete: () => this._loaded.set(true),
    });
  }

  async salvarCategorias(items: ConfigItem[]): Promise<void> {
    await firstValueFrom(
      this.repo.saveCategorias(items).pipe(tap(() => this._categorias.set(items)))
    );
  }

  async salvarPartesMissa(items: ConfigItem[]): Promise<void> {
    await firstValueFrom(
      this.repo.savePartesMissa(items).pipe(tap(() => this._partes.set(items)))
    );
  }

  getLabelCategoria(id: string): string {
    return this.categoriasLabels()[id] ?? id;
  }

  getLabelParte(id: string): string {
    return this.partesLabels()[id] ?? id;
  }
}
