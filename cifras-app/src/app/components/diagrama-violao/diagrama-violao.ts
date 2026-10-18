import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramaAcorde } from '../../models/diagrama.model';

@Component({
  selector: 'app-diagrama-violao',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diagrama-violao.html',
  styleUrl: './diagrama-violao.scss'
})
export class DiagramaViolaoComponent {
  @Input() nome = '';
  @Input() numeroCordas: 4 | 6 = 6;
  @Input() variacoes: DiagramaAcorde[] = [];

  selectedIdx = signal(0);
  diagrama() {
    return this.variacoes[this.selectedIdx()] ?? this.variacoes[0] ?? null;
  }

  readonly marginTop = 12;
  readonly marginLeft = 14;
  readonly cellW = 20;
  readonly cellH = 20;
  get svgW() { return 14 * 2 + (this.numeroCordas - 1) * 20 + 4; }
  readonly svgH = 12 + 5 * 20 + 4;

  readonly rows = [0, 1, 2, 3, 4, 5];
  get cols() { return Array.from({ length: this.numeroCordas }, (_, i) => i); }
  get cordas() { return this.cols.map(c => this.numeroCordas - c); }

  cordasMutadasSet() { return (n: number) => this.diagrama()?.cordasMutadas.includes(n) ?? false; }
  cordasSoltasSet() { return (n: number) => this.diagrama()?.cordasSoltas.includes(n) ?? false; }
}
