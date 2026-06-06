import { Injectable, signal } from '@angular/core';

export interface Notificacao {
  msg: string;
  erro: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly notificacao = signal<Notificacao | null>(null);

  mostrar(msg: string, duracao = 3000): void {
    this.notificacao.set({ msg, erro: false });
    setTimeout(() => this.notificacao.set(null), duracao);
  }

  mostrarErro(msg: string, duracao = 5000): void {
    this.notificacao.set({ msg, erro: true });
    setTimeout(() => this.notificacao.set(null), duracao);
  }
}
