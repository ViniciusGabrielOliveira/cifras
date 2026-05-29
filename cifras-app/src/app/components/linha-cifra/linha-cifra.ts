import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LinhaCifra, AcordeLinha } from '../../models/cifra.model';
import { AcordeLabelComponent } from '../acorde-label/acorde-label';
import { REGEX_ACORDE } from '../../core/transposicao';

export interface Segmento {
  acorde: string | null;
  texto: string;
}

export type RawSegmento =
  | { kind: 'acorde'; prefix: string; acorde: string; suffix: string }
  | { kind: 'texto'; texto: string };

/** Divide a linha em segmentos [acorde + texto] para renderização responsiva */
function computarSegmentos(letra: string, acordes: AcordeLinha[]): Segmento[] {
  if (!acordes.length) {
    return [{ acorde: null, texto: letra || ' ' }];
  }

  const sorted = [...acordes].sort((a, b) => a.posicao - b.posicao);
  const segs: Segmento[] = [];

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

/** Tokeniza rawChordsLine em segmentos para renderização com acordes coloridos */
function computarRawSegmentos(raw: string): RawSegmento[] {
  const segs: RawSegmento[] = [];
  const re = /(\S+|\s+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const token = m[1];
    if (/^\s+$/.test(token)) {
      segs.push({ kind: 'texto', texto: token });
    } else {
      const prefix = token.match(/^\(*/)?.[0] ?? '';
      const suffix = token.match(/\)*$/)?.[0] ?? '';
      const inner = token.slice(prefix.length, token.length - suffix.length);
      if (inner && REGEX_ACORDE.test(inner)) {
        segs.push({ kind: 'acorde', prefix, acorde: inner, suffix });
      } else {
        segs.push({ kind: 'texto', texto: token });
      }
    }
  }
  return segs;
}

@Component({
  selector: 'app-linha-cifra',
  standalone: true,
  imports: [CommonModule, AcordeLabelComponent],
  template: `
    <div class="linha-wrap"
      [class.sem-acordes]="!linha.acordes.length"
      [class.so-acordes]="!linha.letra && linha.acordes.length > 0">

      @if (linha.acordes.length === 0) {
        <span class="seg-texto">{{ linha.letra || '&nbsp;' }}</span>

      } @else if (linha.rawChordsLine) {
        <!-- Linha com parênteses: exibe o texto bruto com acordes coloridos -->
        <div class="linha-raw-acordes">
          @for (seg of rawSegmentos; track $index) {
            @if (seg.kind === 'acorde') {
              @if (seg.prefix) { <span class="raw-paren">{{ seg.prefix }}</span> }
              <app-acorde-label [acorde]="seg.acorde" />
              @if (seg.suffix) { <span class="raw-paren">{{ seg.suffix }}</span> }
            } @else {
              <span class="raw-espaco">{{ seg.texto }}</span>
            }
          }
        </div>
        @if (linha.letra) {
          <div class="linha-letra-abaixo">{{ linha.letra }}</div>
        }

      } @else {
        <!-- Segmentos: cada um tem acorde + texto alinhados em coluna -->
        @for (seg of segmentos; track $index) {
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

  get segmentos() {
    return computarSegmentos(this.linha?.letra ?? '', this.linha?.acordes ?? []);
  }

  get rawSegmentos() {
    return computarRawSegmentos(this.linha?.rawChordsLine ?? '');
  }
}
