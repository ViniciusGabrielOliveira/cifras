import { Component, Input, Output, EventEmitter, inject, computed, signal, OnInit } from '@angular/core';
import { Lista, TipoLista } from '../../models/lista.model';
import { ConfigService } from '../../services/config.service';
import { LiturgiaService } from '../../services/liturgia.service';
import { Liturgia } from '../../models/liturgia.model';
import { AppSelectComponent } from '../app-select/app-select';

@Component({
  selector: 'app-lista-metadata',
  standalone: true,
  imports: [AppSelectComponent],
  templateUrl: './lista-metadata.html',
  styleUrl: './lista-metadata.scss',
})
export class ListaMetadataComponent implements OnInit {
  @Input({ required: true }) lista!: Lista;
  @Input() isAdmin = false;
  @Output() listaChanged = new EventEmitter<Lista>();

  private config = inject(ConfigService);
  private liturgiaService = inject(LiturgiaService);
  readonly liturgias = signal<Liturgia[]>([]);
  readonly erroLiturgias = signal(false);
  readonly ciclos = ['A', 'B', 'C'] as const;
  readonly liturgiasOptions = computed(() => [
    { value: '', label: 'Adicionar liturgia...' },
    ...this.liturgias().map(l => ({ value: l.id, label: l.nome })),
  ]);

  ngOnInit() {
    if (this.isAdmin) this.liturgiaService.catalogoCompleto().subscribe({
      next: catalogo => this.liturgias.set(catalogo.liturgias),
      error: () => this.erroLiturgias.set(true),
    });
  }

  nomeLiturgia(id: string) { return this.liturgias().find(l => l.id === id)?.nome ?? id; }

  adicionarLiturgia(id: string) {
    if (!id || this.lista.liturgiasIds?.includes(id)) return;
    this.listaChanged.emit({ ...this.lista, liturgiasIds: [...(this.lista.liturgiasIds ?? []), id] });
  }

  removerLiturgia(id: string) {
    this.listaChanged.emit({ ...this.lista, liturgiasIds: (this.lista.liturgiasIds ?? []).filter(l => l !== id) });
  }

  toggleCiclo(ciclo: 'A' | 'B' | 'C') {
    const atuais = this.lista.ciclosLiturgicos ?? [];
    this.listaChanged.emit({ ...this.lista, ciclosLiturgicos: atuais.includes(ciclo) ? atuais.filter(c => c !== ciclo) : [...atuais, ciclo] });
  }

  readonly categoriasOptions = computed(() =>
    this.config.categoriasIds().map(id => ({ value: id, label: this.config.categoriasLabels()[id] ?? id }))
  );

  onTituloBlur(event: Event) {
    const val = (event.target as HTMLInputElement).value.trim();
    if (!val || val === this.lista.titulo) return;
    this.listaChanged.emit({ ...this.lista, titulo: val });
  }

  onTodosDiasChange(todos: boolean) {
    const atualizada: Lista = { ...this.lista, todosDias: todos, data: '' };
    if (todos) {
      atualizada.dataInicio = '';
      atualizada.dataFim = '';
    }
    this.listaChanged.emit(atualizada);
  }

  onDataInicioChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.listaChanged.emit({ ...this.lista, dataInicio: val, data: '' });
  }

  onDataFimChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.listaChanged.emit({ ...this.lista, dataFim: val, data: '' });
  }

  onCategoriaChange(categoria: string) {
    this.listaChanged.emit({ ...this.lista, categoria });
  }

  onTipoChange(tipo: TipoLista) {
    this.listaChanged.emit({ ...this.lista, tipo });
  }
}
