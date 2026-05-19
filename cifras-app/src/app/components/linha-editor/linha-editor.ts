import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ViewChild, ElementRef, signal, computed, NgZone, inject, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LinhaCifra, AcordeLinha } from '../../models/cifra.model';
import { REGEX_ACORDE } from '../../core/transposicao';

interface DragState {
  acorde: AcordeLinha;
  startMouseX: number;
  startPosicao: number;
  startPx: number;
}

@Component({
  selector: 'app-linha-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './linha-editor.html',
  styleUrl: './linha-editor.scss',
})
export class LinhaEditorComponent implements OnChanges {
  @Input() linha!: LinhaCifra;
  @Input() linhaIndex!: number;
  @Output() linhaChange = new EventEmitter<LinhaCifra>();
  @Output() removerLinha = new EventEmitter<void>();

  @ViewChild('letraSpan') letraSpan!: ElementRef<HTMLSpanElement>;

  private zone = inject(NgZone);

  // Estado local (cópia da linha para editar)
  texto = signal('');
  acordes = signal<AcordeLinha[]>([]);

  // Offsets em px de cada caractere (para drag)
  charOffsets = signal<number[]>([]);

  // Estado do drag ativo
  private drag: DragState | null = null;

  // Painel de adição de acorde
  addingChord = signal(false);
  newChordName = signal('');
  newChordPos = signal(0);
  hoveredPos = signal<number | null>(null);
  chordError = signal(false);

  // Confirma se alguma mudança foi feita
  dirty = signal(false);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['linha']) {
      this.texto.set(this.linha.letra);
      this.acordes.set(this.linha.acordes.map(a => ({ ...a })));
      this.dirty.set(false);
      // Mede offsets após render
      setTimeout(() => this.medirCharOffsets(), 50);
    }
  }

  /** Mede a posição em px de cada caractere da linha */
  medirCharOffsets() {
    const el = this.letraSpan?.nativeElement;
    if (!el || !el.firstChild || !this.texto()) return;

    const textNode = el.firstChild;
    const texto = this.texto();
    const offsets: number[] = [];
    const elRect = el.getBoundingClientRect();

    for (let i = 0; i <= texto.length; i++) {
      try {
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, Math.min(i, texto.length));
        offsets.push(range.getBoundingClientRect().right - elRect.left);
      } catch {
        offsets.push(i * 9);
      }
    }
    this.zone.run(() => this.charOffsets.set(offsets));
  }

  /** Posição em px de um índice de caractere */
  getCharPx(posicao: number): number {
    const texto = this.texto();
    if (!texto) return posicao * 9;
    const offsets = this.charOffsets();
    if (!offsets.length) return posicao * 9;
    const textLen = texto.length;
    if (posicao <= textLen) return offsets[posicao] ?? posicao * 9;
    // Além do fim do texto: extrapola com largura média
    const lastOffset = offsets[textLen];
    const avgCharWidth = textLen > 0 ? lastOffset / textLen : 9;
    return lastOffset + (posicao - textLen) * avgCharWidth;
  }

  /** Encontra o índice de caractere mais próximo de uma posição em px */
  findClosestChar(px: number): number {
    if (!this.texto()) return Math.max(0, Math.round(px / 9));
    const offsets = this.charOffsets();
    if (!offsets.length) return Math.max(0, Math.round(px / 9));
    const textLen = this.texto().length;
    const lastOffset = offsets[textLen] ?? 0;
    if (px > lastOffset) {
      const avgCharWidth = textLen > 0 ? lastOffset / textLen : 9;
      return textLen + Math.max(1, Math.round((px - lastOffset) / avgCharWidth));
    }
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < offsets.length; i++) {
      const dist = Math.abs(offsets[i] - px);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
  }

  // ─── DRAG ───────────────────────────────────────────────────────────────────

  startDrag(event: MouseEvent, acorde: AcordeLinha) {
    event.preventDefault();
    event.stopPropagation();
    const startPx = this.getCharPx(acorde.posicao);
    this.drag = { acorde, startMouseX: event.clientX, startPosicao: acorde.posicao, startPx };
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.drag) return;
    event.preventDefault();

    const deltaMousePx = event.clientX - this.drag.startMouseX;
    const newPx = this.drag.startPx + deltaMousePx;

    const newPos = Math.max(0, this.findClosestChar(newPx));
    const outros = this.acordes().filter(a => a !== this.drag!.acorde);
    // Sem texto: sem conflito — acorde pode ir para qualquer posição livremente
    if (!this.texto() || !outros.some(a => a.posicao === newPos)) {
      this.drag!.acorde.posicao = newPos;
      this.acordes.update(list => [...list]);
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (!this.drag) return;
    this.drag = null;
    this.emitChange();
  }

  // ─── EDIÇÃO DE LETRA ────────────────────────────────────────────────────────

  onLetraChange(valor: string) {
    this.texto.set(valor);
    this.dirty.set(true);
    // Remede os offsets após mudança do texto
    setTimeout(() => this.medirCharOffsets(), 30);
    this.emitChange();
  }

  // ─── ADICIONAR ACORDE ───────────────────────────────────────────────────────

  openAddChord(posicao = 0) {
    this.newChordPos.set(posicao);
    this.newChordName.set('');
    this.chordError.set(false);
    this.addingChord.set(true);
  }

  selectPosition(pos: number) {
    this.newChordPos.set(pos);
  }

  confirmAddChord() {
    const nome = this.newChordName().trim();
    if (!nome) return;

    if (!REGEX_ACORDE.test(nome)) {
      this.chordError.set(true);
      return;
    }
    this.chordError.set(false);

    // Linha sem letra: posiciona em sequência para não empilhar
    const posicao = this.texto()
      ? this.newChordPos()
      : this.acordes().reduce((max, a) => Math.max(max, a.posicao), -1) + 1;

    const lista = this.acordes().filter(a => a.posicao !== posicao);
    lista.push({ posicao, acorde: nome });
    lista.sort((a, b) => a.posicao - b.posicao);
    this.acordes.set(lista);
    this.addingChord.set(false);
    this.emitChange();
  }

  cancelAddChord() {
    this.addingChord.set(false);
  }

  removeChord(acorde: AcordeLinha) {
    this.acordes.update(list => list.filter(a => a !== acorde));
    this.emitChange();
  }

  // ─── EMIT ────────────────────────────────────────────────────────────────────

  private emitChange() {
    this.linhaChange.emit({
      letra: this.texto(),
      acordes: this.acordes().map(a => ({ ...a })).sort((a, b) => a.posicao - b.posicao),
    });
  }

  get letrasArr(): string[] {
    return this.texto().split('');
  }

  isDragging = computed(() => this.drag !== null);
}
