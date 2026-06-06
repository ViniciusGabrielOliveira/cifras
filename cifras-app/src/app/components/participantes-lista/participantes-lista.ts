import { Component, Input, Output, EventEmitter, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { Lista, RoleParticipante } from '../../models/lista.model';
import { ListaService } from '../../services/lista.service';
import { NotificationService } from '../../services/notification.service';
import { AppSelectComponent } from '../app-select/app-select';

@Component({
  selector: 'app-participantes-lista',
  standalone: true,
  imports: [AppSelectComponent],
  templateUrl: './participantes-lista.html',
  styleUrl: './participantes-lista.scss',
})
export class ParticipantesListaComponent {
  @Input({ required: true }) lista!: Lista;
  @Input({ required: true }) isDono!: boolean;
  @Output() fechar = new EventEmitter<void>();
  @Output() listaAtualizada = new EventEmitter<Lista>();

  private listaService = inject(ListaService);
  private notif = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  linkCopiado = signal(false);
  confirmandoRemover = signal<string | null>(null);

  readonly roleOptions = [
    { value: 'visualizador', label: 'Visualizador' },
    { value: 'editor', label: 'Editor' },
  ];

  get linkConvite(): string {
    const token = this.lista?.tokenConvite;
    if (!token) return '';
    return `${document.baseURI.replace(/\/$/, '')}/join/${token}`;
  }

  copiarLink() {
    navigator.clipboard.writeText(this.linkConvite)
      .then(() => {
        this.linkCopiado.set(true);
        timer(2000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.linkCopiado.set(false));
      })
      .catch(() => this.notif.mostrarErro('Não foi possível copiar o link.'));
  }

  onRoleChange(uid: string, value: string) {
    this.alterarRole(uid, value as RoleParticipante);
  }

  alterarRole(uid: string, role: RoleParticipante) {
    const listaId = this.lista?.id;
    if (!listaId) return;
    this.listaService.atualizarRoleParticipante(listaId, uid, role).subscribe({
      next: () => {
        const atualizada: Lista = {
          ...this.lista,
          participantes: (this.lista.participantes ?? []).map(p =>
            p.uid === uid ? { ...p, role } : p
          ),
        };
        this.listaAtualizada.emit(atualizada);
      },
      error: (err: Error) => this.notif.mostrarErro(err.message || 'Erro ao alterar permissão.'),
    });
  }

  confirmarRemoverParticipante(uid: string) { this.confirmandoRemover.set(uid); }
  cancelarRemoverParticipante() { this.confirmandoRemover.set(null); }

  removerParticipante(uid: string) {
    const listaId = this.lista?.id;
    if (!listaId) return;
    this.listaService.removerParticipante(listaId, uid).subscribe({
      next: () => {
        const atualizada: Lista = {
          ...this.lista,
          participantes: (this.lista.participantes ?? []).filter(p => p.uid !== uid),
        };
        this.confirmandoRemover.set(null);
        this.listaAtualizada.emit(atualizada);
      },
      error: (err: Error) => {
        this.confirmandoRemover.set(null);
        this.notif.mostrarErro(err.message || 'Erro ao remover participante.');
      },
    });
  }

  toggleControladoresUid(uid: string) {
    if (!this.isDono) return;
    const atuais = this.lista.controladoresUids ?? [];
    const novos = atuais.includes(uid) ? atuais.filter(u => u !== uid) : [...atuais, uid];
    this.listaService.atualizarControladoresUids(this.lista.id, novos).subscribe({
      next: () => {
        this.listaAtualizada.emit({ ...this.lista, controladoresUids: novos });
      },
      error: (err: Error) => this.notif.mostrarErro(err.message || 'Erro ao atualizar controladores.'),
    });
  }
}
