import {
  Component, Input, signal, computed, inject, ElementRef,
  HostListener, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramaViolaoComponent } from '../diagrama-violao/diagrama-violao';
import { AcordesService } from '../../services/acordes';

@Component({
  selector: 'app-acorde-label',
  standalone: true,
  imports: [CommonModule, DiagramaViolaoComponent],
  template: `
    <span
      class="acorde-chip"
      (mouseenter)="showPopup.set(true)"
      (mouseleave)="onMouseLeave()"
    >
      {{ acorde }}

      @if (showPopup() && variacoes().length > 0) {
        <div
          class="popup-wrapper"
          (mouseenter)="showPopup.set(true)"
          (mouseleave)="showPopup.set(false)"
        >
          <app-diagrama-violao [variacoes]="variacoes()" [nome]="acorde" />
        </div>
      }
    </span>
  `,
  styleUrl: './acorde-label.scss',
})
export class AcordeLabelComponent {
  @Input() acorde = '';

  showPopup = signal(false);
  private acordesService = inject(AcordesService);

  variacoes = computed(() => this.acordesService.getVariacoes(this.acorde));

  onMouseLeave() {
    setTimeout(() => this.showPopup.set(false), 150);
  }
}
