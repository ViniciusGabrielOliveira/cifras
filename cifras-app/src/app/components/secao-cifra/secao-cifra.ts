import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Secao } from '../../models/cifra.model';
import { LinhaCifraComponent } from '../linha-cifra/linha-cifra';
import { REGEX_ACORDE } from '../../core/transposicao';

const TIPO_ICONS: Record<string, string> = {
  intro: '🎵', verso: '📝', 'pre-refrao': '🎶',
  refrao: '🔁', ponte: '🌉', outro: '🎵', solo: '🎸', tab: '🎸',
};

export interface TabSegmento {
  isAcorde: boolean;
  text: string;
}

export interface TabLinha {
  isTab: boolean;    // linha com E| B| G| D| A| e|
  segmentos: TabSegmento[];
}

function parsearTabLinha(linha: string): TabLinha {
  // Linha de tablatura: começa com nome de corda seguido de |
  if (/^[EBGDAe]\|/.test(linha.trim())) {
    return { isTab: true, segmentos: [{ isAcorde: false, text: linha }] };
  }

  // Linha de acordes: segmenta em tokens preservando espaços
  const segmentos: TabSegmento[] = [];
  const re = /(\S+|\s+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linha)) !== null) {
    const token = m[1];
    const isAcorde = /^\S+$/.test(token) && REGEX_ACORDE.test(token);
    segmentos.push({ isAcorde, text: token });
  }
  return { isTab: false, segmentos };
}

@Component({
  selector: 'app-secao-cifra',
  standalone: true,
  imports: [CommonModule, LinhaCifraComponent],
  templateUrl: './secao-cifra.html',
  styleUrl: './secao-cifra.scss',
})
export class SecaoCifraComponent {
  @Input() secao!: Secao;

  get icon(): string {
    return TIPO_ICONS[this.secao.tipo] ?? '🎵';
  }

  get tabLinhas(): TabLinha[] {
    if (!this.secao.tabText) return [];
    return this.secao.tabText.split('\n').map(parsearTabLinha);
  }
}
