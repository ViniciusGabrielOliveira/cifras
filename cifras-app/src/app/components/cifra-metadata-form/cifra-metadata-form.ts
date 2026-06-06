import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Cifra } from '../../models/cifra.model';
import { ConfigService } from '../../services/config.service';
import { AppSelectComponent } from '../app-select/app-select';
import { slugify, TONS } from '../../core/cifra-parser';

const INSTRUMENTO_OPTIONS = [
  { value: 'violao',   label: 'Violão' },
  { value: 'guitarra', label: 'Guitarra' },
  { value: 'cavaco',   label: 'Cavaquinho' },
  { value: 'ukulele',  label: 'Ukulele' },
];

const DIFICULDADE_OPTIONS = [
  { value: 'iniciante',     label: 'Iniciante' },
  { value: 'basico',        label: 'Básico' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado',      label: 'Avançado' },
];

@Component({
  selector: 'app-cifra-metadata-form',
  standalone: true,
  imports: [CommonModule, AppSelectComponent],
  templateUrl: './cifra-metadata-form.html',
  styleUrl: './cifra-metadata-form.scss',
})
export class CifraMetadataFormComponent {
  @Input({ required: true }) cifra!: Cifra;
  @Input() modoEditar = false;
  @Input() erroTitulo = false;
  @Output() cifraChange = new EventEmitter<Cifra>();

  private config = inject(ConfigService);

  readonly tonsOptions = TONS;
  readonly instrumentoOptions = INSTRUMENTO_OPTIONS;
  readonly dificuldadeOptions = DIFICULDADE_OPTIONS;

  get categorias() { return this.config.categorias(); }
  get partesMissa() { return this.config.partesMissa(); }

  get idGerado(): string {
    return this.cifra?.id || '(preencha o título)';
  }

  updateMeta(field: keyof Cifra, value: string) {
    const updated: Cifra = { ...this.cifra, [field]: value };
    if (field === 'titulo' && !this.modoEditar) updated.id = slugify(value);
    this.cifraChange.emit(updated);
  }

  toggleCategoria(id: string) {
    const cats = this.cifra.categorias ?? [];
    this.cifraChange.emit({
      ...this.cifra,
      categorias: cats.includes(id) ? cats.filter(x => x !== id) : [...cats, id],
    });
  }

  toggleParte(id: string) {
    const partes = this.cifra.partesMissa ?? [];
    this.cifraChange.emit({
      ...this.cifra,
      partesMissa: partes.includes(id) ? partes.filter(x => x !== id) : [...partes, id],
    });
  }
}
