import { Component, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Lista, MusicaLista } from '../../models/lista.model';

type CacheEntry = { estado: 'carregando' } | { estado: 'ok'; cifra: Cifra } | { estado: 'nao_encontrado' };
import { Cifra, CifraCustom, CifraVersao } from '../../models/cifra.model';
import { CifraViewerComponent } from '../cifra-viewer/cifra-viewer';
import { CifraService } from '../../services/cifra.service';
import { AuthService } from '../../services/auth.service';
import { LiveEstado } from '../../models/live.model';

@Component({
    selector: 'app-acordeon-musica',
    standalone: true,
    imports: [CifraViewerComponent],
    templateUrl: './acordeon-musica.html',
    styleUrl: './acordeon-musica.scss',
})
export class AcordeonMusicaComponent {
    private cifraService = inject(CifraService);
    readonly auth = inject(AuthService);

    readonly lista        = input.required<Lista | null>();
    readonly musicas      = input<MusicaLista[]>([]);
    readonly canEdit      = input(false);
    readonly modoLiveAtivo       = input(false);
    readonly modoControladorAtivo = input(false);
    readonly liveEstado   = input<LiveEstado | null>(null);

    readonly tomAlterado    = output<{ musicaId: string; tom: string }>();
    readonly observacaoAlterada = output<{ musicaId: string; obs: string }>();
    readonly musicaRemovida = output<string>();
    readonly musicaAbertaChanged = output<{ musicaId: string | null; parteId: string | null }>();
    readonly adicionarMusicaClick = output<void>();

    acordeonAberto = signal<string | null>(null);
    cifrasCache    = signal<Record<string, CacheEntry>>({});
    customCache    = signal<Record<string, CifraCustom | null>>({});
    versoesCache   = signal<Record<string, CifraVersao[]>>({});
    confirmandoRemoverMusica = signal<string | null>(null);

    private _obsTimers = new Map<string, ReturnType<typeof setTimeout>>();

    // Abre/fecha pelo controlador externo (live mode sync)
    sincronizarAberto(musicaId: string | null) {
        this.acordeonAberto.set(musicaId);
        if (musicaId) {
            const musica = this.musicas().find(m => m.id === musicaId);
            if (musica) this.carregarCifra(musica);
        }
    }

    toggleMusicaFromBtn(musica: MusicaLista, btn: HTMLButtonElement) {
        const cardEl = btn.closest('.musica-card') as HTMLElement | null;
        this.toggleMusica(musica, cardEl ?? btn);
    }

    toggleMusica(musica: MusicaLista, el: HTMLElement) {
        const jaAberta = this.acordeonAberto() === musica.id;
        this.acordeonAberto.set(jaAberta ? null : musica.id);

        if (!jaAberta) {
            this.carregarCifra(musica, () => {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        this.musicaAbertaChanged.emit({
            musicaId: jaAberta ? null : musica.id,
            parteId: musica.parte,
        });
    }

    private carregarCifra(musica: MusicaLista, onCarregado?: () => void) {
        const { cifraId } = musica;
        const cache = this.cifrasCache();
        if (cifraId in cache) {
            if (onCarregado) requestAnimationFrame(() => requestAnimationFrame(onCarregado));
            return;
        }

        this.cifrasCache.update(c => ({ ...c, [cifraId]: { estado: 'carregando' } }));

        const lista = this.lista();
        const listaId = lista?.id;

        const carregarPrincipal = () => {
            this.cifraService.getCifra(cifraId).subscribe(cifra => {
                this.cifrasCache.update(c => ({ ...c, [cifraId]: cifra ? { estado: 'ok', cifra } : { estado: 'nao_encontrado' } }));
                if (cifra && listaId && lista?.tipo === 'privada') {
                    this.cifraService.salvarCifraEmLista(listaId, cifra).subscribe();
                }
                if (onCarregado) requestAnimationFrame(() => requestAnimationFrame(onCarregado));
            });
        };

        if (listaId && lista?.tipo === 'privada') {
            this.cifraService.getCifraEmLista(listaId, cifraId).subscribe(cifra => {
                if (cifra) {
                    this.cifrasCache.update(c => ({ ...c, [cifraId]: { estado: 'ok', cifra } }));
                    if (onCarregado) requestAnimationFrame(() => requestAnimationFrame(onCarregado));
                } else {
                    carregarPrincipal();
                }
            });
        } else {
            carregarPrincipal();
        }

        if (listaId) {
            const cacheKey = `${listaId}_${cifraId}`;
            if (!(cacheKey in this.customCache())) this.carregarMelhorCustom(listaId, cifraId);
        }

        if (!(cifraId in this.versoesCache())) {
            this.cifraService.getVersoes(cifraId).subscribe(versoes => {
                if (versoes.length > 0) this.versoesCache.update(v => ({ ...v, [cifraId]: versoes }));
            });
        }
    }

    private carregarMelhorCustom(listaId: string, cifraId: string) {
        const lista = this.lista();
        const editorUids = new Set<string>();
        if (lista?.donoUid) editorUids.add(lista.donoUid);
        lista?.participantes?.filter(p => p.role === 'editor').forEach(p => editorUids.add(p.uid));
        if (editorUids.size === 0) return;

        const cacheKey = `${listaId}_${cifraId}`;
        this.customCache.update(c => ({ ...c, [cacheKey]: null }));

        forkJoin(Array.from(editorUids).map(uid => this.cifraService.getCifraCustom(uid, cifraId)))
            .subscribe(customs => {
                const melhor = customs
                    .filter((c): c is CifraCustom => c != null)
                    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))[0] ?? null;
                this.customCache.update(c => ({ ...c, [cacheKey]: melhor }));
            });
    }

    isCarregandoCifra(cifraId: string): boolean {
        const cache = this.cifrasCache();
        return cifraId in cache && cache[cifraId].estado === 'carregando';
    }

    getCifraEfetiva(cifraId: string): Cifra | null {
        const val = this.cifrasCache()[cifraId];
        const cifra = val?.estado === 'ok' ? val.cifra : null;
        if (!cifra) return null;
        const listaId = this.lista()?.id;
        const custom = listaId ? this.customCache()[`${listaId}_${cifraId}`] : null;
        return custom ? { ...cifra, secoes: custom.secoes } : cifra;
    }

    getVersoes(cifraId: string): CifraVersao[] {
        return this.versoesCache()[cifraId] ?? [];
    }

    onTomAlterado(musicaId: string, tom: string) {
        this.tomAlterado.emit({ musicaId, tom });
    }

    onObservacaoAlterada(musicaId: string, obs: string) {
        this.observacaoAlterada.emit({ musicaId, obs });
    }

    onRemoverMusica(musicaId: string) {
        this.musicaRemovida.emit(musicaId);
        this.confirmandoRemoverMusica.set(null);
        if (this.acordeonAberto() === musicaId) this.acordeonAberto.set(null);
    }
}
