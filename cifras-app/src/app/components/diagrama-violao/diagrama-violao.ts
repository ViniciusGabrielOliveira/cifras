import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramaAcorde } from '../../models/diagrama.model';

@Component({
  selector: 'app-diagrama-violao',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="diagrama-card">
      <div class="diagrama-header">
        <span class="diagrama-nome">{{ nome }}</span>
        @if (variacoes.length > 1) {
          <div class="diagrama-tabs">
            @for (v of variacoes; track v.variacao; let i = $index) {
              <button
                class="tab-btn"
                [class.active]="selectedIdx() === i"
                (click)="selectedIdx.set(i)"
              >{{ v.variacao }}</button>
            }
          </div>
        }
      </div>

      @if (diagrama(); as d) {
        <div class="svg-wrap">
          @if (d.casaBase > 1) {
            <span class="casa-base">{{ d.casaBase }}ª</span>
          }

          <!-- Sinais acima (X e O) -->
          <div class="sinais-topo" [style.padding-left.px]="marginLeft - 2">
            @for (c of [5,4,3,2,1,0]; track c) {
              <span class="sinal" [class.x]="cordasMutadasSet()(c+1)" [class.o]="cordasSoltasSet()(c+1)">
                {{ cordasMutadasSet()(c+1) ? '✕' : cordasSoltasSet()(c+1) ? '○' : '' }}
              </span>
            }
          </div>

          <svg
            [attr.viewBox]="'0 0 ' + svgW + ' ' + svgH"
            [attr.width]="svgW"
            [attr.height]="svgH"
          >
            <!-- Linhas horizontais (casas) -->
            @for (row of rows; track row) {
              <line
                [attr.x1]="marginLeft"
                [attr.y1]="row * cellH + marginTop"
                [attr.x2]="marginLeft + 5 * cellW"
                [attr.y2]="row * cellH + marginTop"
                stroke="var(--color-frets)"
                stroke-width="1"
              />
            }

            <!-- Cabeça do braço (linha mais grossa) -->
            @if (d.casaBase === 1) {
              <rect
                [attr.x]="marginLeft"
                [attr.y]="marginTop - 5"
                [attr.width]="5 * cellW"
                height="5"
                fill="var(--color-nut)"
                rx="1"
              />
            }

            <!-- Cordas verticais -->
            @for (col of cols; track col) {
              <line
                [attr.x1]="col * cellW + marginLeft"
                [attr.y1]="marginTop"
                [attr.x2]="col * cellW + marginLeft"
                [attr.y2]="5 * cellH + marginTop"
                stroke="var(--color-strings)"
                [attr.stroke-width]="1 + (5 - col) * 0.15"
              />
            }

            <!-- Pestana -->
            @if (d.pestana) {
              <rect
                [attr.x]="marginLeft + 1"
                [attr.y]="(d.pestana - d.casaBase) * cellH + marginTop + 2"
                [attr.width]="5 * cellW - 2"
                [attr.height]="cellH - 4"
                fill="var(--color-acorde)"
                rx="8"
                opacity="0.9"
              />
            }

            <!-- Bolinhas dos dedos -->
            @for (dedo of d.dedos; track dedo.corda + '-' + dedo.casa) {
              @if (!d.pestana || dedo.casa !== d.pestana || dedo.corda !== 1) {
                <circle
                  [attr.cx]="(6 - dedo.corda) * cellW + marginLeft"
                  [attr.cy]="(dedo.casa - d.casaBase + 0.5) * cellH + marginTop"
                  r="7"
                  fill="var(--color-acorde)"
                />
              }
            }
          </svg>
        </div>
      }
    </div>
  `,
  styleUrl: './diagrama-violao.scss'
})
export class DiagramaViolaoComponent {
  @Input() nome = '';
  @Input() variacoes: DiagramaAcorde[] = [];

  selectedIdx = signal(0);
  diagrama = computed(() => this.variacoes[this.selectedIdx()] ?? null);

  readonly marginTop = 12;
  readonly marginLeft = 14;
  readonly cellW = 20;
  readonly cellH = 20;
  readonly svgW = 14 * 2 + 5 * 20 + 4;
  readonly svgH = 12 + 5 * 20 + 4;

  readonly rows = [0, 1, 2, 3, 4, 5];
  readonly cols = [0, 1, 2, 3, 4, 5];

  cordasMutadasSet = computed(() => {
    const d = this.diagrama();
    const set = new Set(d?.cordasMutadas ?? []);
    return (n: number) => set.has(n);
  });

  cordasSoltasSet = computed(() => {
    const d = this.diagrama();
    const set = new Set(d?.cordasSoltas ?? []);
    return (n: number) => set.has(n);
  });
}
