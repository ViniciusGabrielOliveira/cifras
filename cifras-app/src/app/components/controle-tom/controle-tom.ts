import { Component, Input, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Cifra } from '../../models/cifra.model';
import { transporCifra } from '../../core/transposicao';

const NOTAS_DISPLAY = ['A', 'A#/Bb', 'B', 'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab'];

@Component({
  selector: 'app-controle-tom',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="controle-tom">
      <span class="label-tom">Tom</span>

      <div class="btns">
        <button
          class="btn-tom"
          (click)="mudar(-1)"
          title="Meio tom abaixo"
          aria-label="Meio tom abaixo"
        >−</button>

        <span class="tom-atual">{{ cifraAtual().tom }}</span>

        <button
          class="btn-tom"
          (click)="mudar(1)"
          title="Meio tom acima"
          aria-label="Meio tom acima"
        >+</button>
      </div>

      @if (delta() !== 0) {
        <button class="btn-restaurar" (click)="restaurar()">
          Restaurar
        </button>
      }
    </div>
  `,
  styleUrl: './controle-tom.scss',
})
export class ControleTomComponent {
  @Input({ required: true }) set cifraOriginal(c: Cifra) {
    this._cifraOriginal.set(c);
    this.delta.set(0);
  }

  private _cifraOriginal = signal<Cifra | null>(null);
  delta = signal(0);

  cifraAtual = computed(() => {
    const c = this._cifraOriginal();
    if (!c) return { tom: '—' } as any;
    return transporCifra(c, this.delta());
  });

  mudar(semitom: number) {
    this.delta.update(d => d + semitom);
  }

  restaurar() {
    this.delta.set(0);
  }
}
