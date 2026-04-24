import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LinhaCifra, AcordeLinha } from '../../models/cifra.model';
import { AcordeLabelComponent } from '../acorde-label/acorde-label';

export interface Segmento {
  acorde: string | null;
  texto: string;
}

/** Divide a linha em segmentos [acorde + texto] para renderização responsiva */
function computarSegmentos(letra: string, acordes: AcordeLinha[]): Segmento[] {
  if (!acordes.length) {
    return [{ acorde: null, texto: letra || ' ' }];
  }

  const sorted = [...acordes].sort((a, b) => a.posicao - b.posicao);
  const segs: Segmento[] = [];

  // Texto antes do primeiro acorde (sem acorde)
  if (sorted[0].posicao > 0) {
    segs.push({ acorde: null, texto: letra.slice(0, sorted[0].posicao) });
  }

  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].posicao;
    const end = sorted[i + 1]?.posicao ?? letra.length;
    segs.push({
      acorde: sorted[i].acorde,
      texto: letra.slice(start, end) || ' ',
    });
  }

  return segs;
}

@Component({
  selector: 'app-linha-cifra',
  standalone: true,
  imports: [CommonModule, AcordeLabelComponent],
  template: `
    <div class="linha-wrap" [class.sem-acordes]="!linha.acordes.length">

      @if (linha.acordes.length === 0) {
        <!-- Linha só de letra, sem acordes -->
        <span class="seg-texto">{{ linha.letra || '&nbsp;' }}</span>

      } @else {
        <!-- Segmentos: cada um tem acorde + texto alinhados em coluna -->
        @for (seg of segmentos(); track $index) {
          <span class="segmento">
            <span class="seg-acorde">
              @if (seg.acorde) {
                <app-acorde-label [acorde]="seg.acorde" />
              }
            </span>
            <span class="seg-texto">{{ seg.texto }}</span>
          </span>
        }
      }

    </div>
  `,
  styleUrl: './linha-cifra.scss',
})
export class LinhaCifraComponent {
  @Input() linha!: LinhaCifra;

  segmentos = computed(() =>
    computarSegmentos(this.linha?.letra ?? '', this.linha?.acordes ?? [])
  );
}
