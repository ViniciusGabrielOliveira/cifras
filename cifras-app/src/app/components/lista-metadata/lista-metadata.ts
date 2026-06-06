import { Component, Input, Output, EventEmitter, inject, computed } from '@angular/core';
import { Lista, TipoLista } from '../../models/lista.model';
import { ConfigService } from '../../services/config.service';
import { AppSelectComponent } from '../app-select/app-select';

@Component({
  selector: 'app-lista-metadata',
  standalone: true,
  imports: [AppSelectComponent],
  templateUrl: './lista-metadata.html',
  styleUrl: './lista-metadata.scss',
})
export class ListaMetadataComponent {
  @Input({ required: true }) lista!: Lista;
  @Input() isAdmin = false;
  @Output() listaChanged = new EventEmitter<Lista>();

  private config = inject(ConfigService);

  readonly categoriasOptions = computed(() =>
    this.config.categoriasIds().map(id => ({ value: id, label: this.config.categoriasLabels()[id] ?? id }))
  );

  onTituloBlur(event: Event) {
    const val = (event.target as HTMLInputElement).value.trim();
    if (!val || val === this.lista.titulo) return;
    this.listaChanged.emit({ ...this.lista, titulo: val });
  }

  onTodosDiasChange(todos: boolean) {
    const atualizada: Lista = { ...this.lista, todosDias: todos || undefined };
    if (todos) {
      delete atualizada.dataInicio;
      delete atualizada.dataFim;
    }
    this.listaChanged.emit(atualizada);
  }

  onDataInicioChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.listaChanged.emit({ ...this.lista, dataInicio: val || undefined });
  }

  onDataFimChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.listaChanged.emit({ ...this.lista, dataFim: val || undefined });
  }

  onCategoriaChange(categoria: string) {
    this.listaChanged.emit({ ...this.lista, categoria });
  }

  onTipoChange(tipo: TipoLista) {
    this.listaChanged.emit({ ...this.lista, tipo });
  }
}
