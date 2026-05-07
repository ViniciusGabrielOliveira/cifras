import {
  Component, Input, signal, inject, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramaViolaoComponent } from '../diagrama-violao/diagrama-violao';
import { AcordesService } from '../../services/acordes';
import { DiagramaAcorde } from '../../models/diagrama.model';

@Component({
  selector: 'app-acorde-label',
  standalone: true,
  imports: [CommonModule, DiagramaViolaoComponent],
  template: `
    <span
      class="acorde-chip"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
    >
      {{ acorde }}

      @if (showPopup()) {
        <div
          class="popup-wrapper"
          [style.top.px]="popupTop"
          [style.left.px]="popupLeft"
          (mouseenter)="onMouseEnter()"
          (mouseleave)="showPopup.set(false)"
        >
          @if (carregando()) {
            <div class="diagrama-loading">
              <span class="spinner-mini"></span>
            </div>
          } @else if (variacoes().length > 0) {
            <app-diagrama-violao [variacoes]="variacoes()" [nome]="acorde" />
          }
        </div>
      }
    </span>
  `,
  styleUrl: './acorde-label.scss',
})
export class AcordeLabelComponent {
  @Input() acorde = '';

  showPopup = signal(false);
  carregando = signal(false);
  variacoes = signal<DiagramaAcorde[]>([]);

  private acordesService = inject(AcordesService);
  private el = inject(ElementRef);

  popupTop = 0;
  popupLeft = 0;

  onMouseEnter() {
    this.showPopup.set(true);
    const rect = this.el.nativeElement.getBoundingClientRect();
    
    // Estima a largura do modal do acorde (costuma ser ~160px)
    const estimatedWidth = 170;
    const viewportWidth = window.innerWidth;
    
    this.popupTop = rect.bottom + 4;
    
    // Ajusta a posição horizontal para não cortar na direita
    let calcLeft = rect.left;
    if (calcLeft + estimatedWidth > viewportWidth - 16) {
      calcLeft = viewportWidth - estimatedWidth - 16;
    }
    
    this.popupLeft = Math.max(16, calcLeft);

    // Já está no cache → exibe imediatamente
    const cached = this.acordesService.getVariacoes(this.acorde);
    if (cached.length > 0) {
      this.variacoes.set(cached);
      return;
    }

    // Não está no cache → busca just-in-time
    this.carregando.set(true);
    this.acordesService.preCarregarAcordes([this.acorde]).subscribe({
      next: () => {
        this.variacoes.set(this.acordesService.getVariacoes(this.acorde));
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }

  onMouseLeave() {
    setTimeout(() => this.showPopup.set(false), 150);
  }
}
