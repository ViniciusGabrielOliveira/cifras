import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Secao } from '../../models/cifra.model';
import { LinhaCifraComponent } from '../linha-cifra/linha-cifra';

const TIPO_ICONS: Record<string, string> = {
  intro: '🎵', verso: '📝', 'pre-refrao': '🎶',
  refrao: '🔁', ponte: '🌉', outro: '🎵', solo: '🎸',
};

@Component({
  selector: 'app-secao-cifra',
  standalone: true,
  imports: [CommonModule, LinhaCifraComponent],
  template: `
    <div class="secao">
      <div class="secao-header">
        <span class="secao-icon">{{ icon }}</span>
        <span class="secao-label">{{ secao.label }}</span>
      </div>
      <div class="secao-body">
        @for (linha of secao.linhas; track $index) {
          <app-linha-cifra [linha]="linha" />
        }
      </div>
    </div>
  `,
  styleUrl: './secao-cifra.scss',
})
export class SecaoCifraComponent {
  @Input() secao!: Secao;

  get icon(): string {
    return TIPO_ICONS[this.secao.tipo] ?? '🎵';
  }
}
