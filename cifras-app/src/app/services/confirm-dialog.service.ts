import { Injectable, signal } from '@angular/core';

export interface DialogEstado {
  mensagem: string;
  resolver: (valor: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly estado = signal<DialogEstado | null>(null);

  confirmar(mensagem: string): Promise<boolean> {
    return new Promise(resolve => {
      this.estado.set({ mensagem, resolver: resolve });
    });
  }

  responder(valor: boolean): void {
    this.estado()?.resolver(valor);
    this.estado.set(null);
  }
}
