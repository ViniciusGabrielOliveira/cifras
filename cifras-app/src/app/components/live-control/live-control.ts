import { Component, inject, input, output, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { LiveService } from '../../services/live.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { LiveEstado } from '../../models/live.model';
import { ToggleComponent } from '../toggle/toggle';

export interface LiveSyncEvent {
    musicaAbertaId: string | null;
    scrollY: number | null;
    parteAtiva: string | null;
}

@Component({
    selector: 'app-live-control',
    standalone: true,
    imports: [ToggleComponent],
    templateUrl: './live-control.html',
    styleUrl: './live-control.scss',
})
export class LiveControlComponent implements OnDestroy {
    private liveService = inject(LiveService);
    private auth = inject(AuthService);
    private notif = inject(NotificationService);

    readonly listaId = input<string | null>(null);
    readonly mostrar = input(false);
    readonly isControlador = input(false);
    readonly musicaAbertaId = input<string | null>(null);
    readonly parteAtiva = input<string | null>(null);

    readonly liveSync = output<LiveSyncEvent>();
    readonly liveError = output<string>();

    modoLiveAtivo       = signal(false);
    modoControladorAtivo = signal(false);
    liveEstado           = signal<LiveEstado | null>(null);

    private liveSub?: Subscription;
    private scrollHandler?: EventListener;
    private lastSyncedMusicaId: string | null = null;

    ngOnDestroy() {
        this.liveSub?.unsubscribe();
        this.removerScrollHandler();
    }

    toggleLive() {
        const novo = !this.modoLiveAtivo();
        this.modoLiveAtivo.set(novo);
        if (novo) {
            const listaId = this.listaId();
            if (!listaId) return;
            this.liveSub = this.liveService.getEstado(listaId).subscribe({
                error: (err: unknown) => {
                    this.modoLiveAtivo.set(false);
                    this.modoControladorAtivo.set(false);
                    this.liveEstado.set(null);
                    this.removerScrollHandler();
                    const msg = (err instanceof Error && err.message.includes('permission'))
                        ? 'Sem permissão para acessar o live. Verifique se você é participante da lista.'
                        : 'Não foi possível conectar ao modo live. Tente novamente.';
                    this.notif.mostrarErro(msg);
                },
                next: (estado) => {
                    this.liveEstado.set(estado);
                    if (this.modoControladorAtivo()) return;

                    const idAberto = estado?.musicaAbertaId ?? null;
                    const musicaMudou = idAberto !== this.lastSyncedMusicaId;
                    this.lastSyncedMusicaId = idAberto;

                    if (musicaMudou) {
                        this.liveSync.emit({
                            musicaAbertaId: idAberto,
                            scrollY: null,
                            parteAtiva: estado?.parteAtiva ?? null,
                        });
                    } else if (estado?.scrollY != null) {
                        this.liveSync.emit({ musicaAbertaId: null, scrollY: estado.scrollY, parteAtiva: null });
                    }
                },
            });
        } else {
            this.liveSub?.unsubscribe();
            this.liveSub = undefined;
            this.liveEstado.set(null);
            this.lastSyncedMusicaId = null;
            if (this.modoControladorAtivo()) {
                this.modoControladorAtivo.set(false);
                this.removerScrollHandler();
            }
        }
    }

    toggleControlador() {
        if (!this.modoLiveAtivo()) this.toggleLive();
        const novo = !this.modoControladorAtivo();
        this.modoControladorAtivo.set(novo);
        if (novo) {
            this.instalarScrollHandler();
            const listaId = this.listaId();
            if (listaId) {
                this.liveService.atualizar(listaId, {
                    ativo: true,
                    atualizadoPor: this.auth.user()?.uid ?? null,
                    musicaAbertaId: this.musicaAbertaId(),
                    scrollY: window.scrollY,
                    parteAtiva: this.parteAtiva(),
                }).catch(() => {});
            }
        } else {
            this.removerScrollHandler();
        }
    }

    notificarMusicaAberta(musicaId: string | null, parteId: string | null) {
        if (!this.modoControladorAtivo()) return;
        const listaId = this.listaId();
        if (!listaId) return;
        this.liveService.atualizar(listaId, {
            musicaAbertaId: musicaId,
            scrollY: musicaId ? 0 : window.scrollY,
            ativo: true,
            atualizadoPor: this.auth.user()?.uid ?? null,
            parteAtiva: parteId,
        }).catch(() => {});
    }

    private instalarScrollHandler() {
        this.removerScrollHandler();
        const listaId = this.listaId();
        if (!listaId) return;
        let t: ReturnType<typeof setTimeout>;
        this.scrollHandler = () => {
            clearTimeout(t);
            t = setTimeout(() => {
                this.liveService.atualizar(listaId, { scrollY: window.scrollY }).catch(() => {});
            }, 200);
        };
        window.addEventListener('scroll', this.scrollHandler, { passive: true });
    }

    private removerScrollHandler() {
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = undefined;
        }
    }
}
