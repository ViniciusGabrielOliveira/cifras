import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ViewChild, ElementRef, signal, computed, NgZone, inject, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LinhaCifra, AcordeLinha } from '../../models/cifra.model';

interface DragState {
  acorde: AcordeLinha;
  startMouseX: number;
  startPosicao: number;
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
    if (!el || !el.firstChild) return;

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
    const offsets = this.charOffsets();
    return offsets[posicao] ?? posicao * 9;
  }

  /** Encontra o índice de caractere mais próximo de uma posição em px */
  findClosestChar(px: number): number {
    const offsets = this.charOffsets();
    if (!offsets.length) return 0;
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
    this.drag = {
      acorde,
      startMouseX: event.clientX,
      startPosicao: acorde.posicao,
    };
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.drag) return;
    event.preventDefault();

    const deltaMousePx = event.clientX - this.drag.startMouseX;
    const startPx = this.getCharPx(this.drag.startPosicao);
    const newPx = startPx + deltaMousePx;
    const newPos = Math.max(0, Math.min(
      this.texto().length - 1,
      this.findClosestChar(newPx),
    ));

    // Atualiza posição do acorde sem conflito com outros acordes
    const outros = this.acordes().filter(a => a !== this.drag!.acorde);
    const conflito = outros.some(a => a.posicao === newPos);

    if (!conflito) {
      this.drag.acorde.posicao = newPos;
      // Força detecção de mudança
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
    this.addingChord.set(true);
  }

  selectPosition(pos: number) {
    this.newChordPos.set(pos);
  }

  confirmAddChord() {
    const nome = this.newChordName().trim();
    if (!nome) return;

    const posicao = this.newChordPos();
    // Remove acorde que já ocupa a mesma posição
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
