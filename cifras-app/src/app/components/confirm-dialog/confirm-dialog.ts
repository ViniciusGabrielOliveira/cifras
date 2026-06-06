import { Component, inject } from '@angular/core';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (service.estado(); as dialog) {
      <div class="confirm-overlay" (click)="service.responder(false)" role="presentation">
        <div class="confirm-box" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="alertdialog" [attr.aria-modal]="true">
          <p class="confirm-mensagem">{{ dialog.mensagem }}</p>
          <div class="confirm-acoes">
            <button class="btn-cancelar" (click)="service.responder(false)">Cancelar</button>
            <button class="btn-confirmar" (click)="service.responder(true)" cdkFocusInitial>Confirmar</button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialogComponent {
  readonly service = inject(ConfirmDialogService);
}
