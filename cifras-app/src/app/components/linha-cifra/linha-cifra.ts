import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LinhaCifra, AcordeLinha } from '../../models/cifra.model';
import { AcordeLabelComponent } from '../acorde-label/acorde-label';

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
function computarRawSegmentos(raw: string, acordes: AcordeLinha[]): RawSegmento[] {
  const segs: RawSegmento[] = [];
  let cursor = 0;
  for (const { acorde, posicao } of [...acordes].sort((a, b) => a.posicao - b.posicao)) {
    if (posicao < cursor) continue;
    if (posicao > cursor) segs.push({ kind: 'texto', texto: raw.slice(cursor, posicao) });
    segs.push({ kind: 'acorde', prefix: '', acorde, suffix: '' });
    cursor = posicao + acorde.length;
  }
  if (cursor < raw.length) segs.push({ kind: 'texto', texto: raw.slice(cursor) });
  return segs;
}

@Component({
  selector: 'app-linha-cifra',
  standalone: true,
  imports: [CommonModule, AcordeLabelComponent],
  templateUrl: './linha-cifra.html',
  styleUrl: './linha-cifra.scss',
})
export class LinhaCifraComponent {
  @Input() linha!: LinhaCifra;

  get segmentos() {
    return computarSegmentos(this.linha?.letra ?? '', this.linha?.acordes ?? []);
  }

  get rawSegmentos() {
    return computarRawSegmentos(this.linha?.rawChordsLine ?? '', this.linha?.acordes ?? []);
  }
}
