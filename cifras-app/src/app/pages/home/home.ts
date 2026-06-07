import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription, Subject, debounceTime, switchMap } from 'rxjs';
import { Lista, MusicaLista } from '../../models/lista.model';
import { ListaService } from '../../services/lista.service';
import { CifraService } from '../../services/cifra.service';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';
import { MusicaSearchComponent, MusicaSelecionada } from '../../components/musica-search/musica-search';
import { SeletorRepertorioComponent } from '../../components/seletor-repertorio/seletor-repertorio';
import { EditarListaSheetComponent } from '../../components/editar-lista-sheet/editar-lista-sheet';
import { LiveControlComponent, LiveSyncEvent } from '../../components/live-control/live-control';
import { TabsListaComponent } from '../../components/tabs-lista/tabs-lista';
import { AcordeonMusicaComponent } from '../../components/acordeon-musica/acordeon-musica';
import { formatarDataLonga } from '../../utils/date.utils';
import { NotificationService } from '../../services/notification.service';
import { ThemeService } from '../../services/theme.service';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [
        RouterLink,
        SeletorRepertorioComponent, EditarListaSheetComponent,
        MusicaSearchComponent, LiveControlComponent,
        TabsListaComponent, AcordeonMusicaComponent,
    ],
    templateUrl: './home.html',
    styleUrl: './home.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
    private listaService = inject(ListaService);
    private cifraService = inject(CifraService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    readonly config = inject(ConfigService);
    readonly auth = inject(AuthService);
    readonly notif = inject(NotificationService);
    readonly theme = inject(ThemeService);

    @ViewChild(SeletorRepertorioComponent) seletorRef!: SeletorRepertorioComponent;
    @ViewChild(EditarListaSheetComponent) editarRef!: EditarListaSheetComponent;
    @ViewChild(LiveControlComponent) liveCtrl!: LiveControlComponent;
    @ViewChild(AcordeonMusicaComponent) acordeon!: AcordeonMusicaComponent;
    @ViewChild('tituloInputEl') tituloInputEl?: ElementRef<HTMLInputElement>;

    readonly listaIdParam = this.route.snapshot.queryParamMap.get('listaId');

    private static readonly STORAGE_KEY = 'cifras-ultima-lista';

    listaAtual    = signal<Lista | null>(null);
    loading       = signal(true);
    readonly autoSelecionarComponente = signal(true);

    parteAtiva = signal<string | null>(null);

    readonly isAdmin = computed(() => this.auth.hasRole('admin'));

    readonly isDonoListaAtual = computed(() => {
        const uid = this.auth.user()?.uid;
        const lista = this.listaAtual();
        return !!uid && !!lista && lista.donoUid === uid && lista.tipo === 'privada';
    });

    readonly isEditorDaListaAtual = computed(() => {
        const uid = this.auth.user()?.uid;
        const lista = this.listaAtual();
        if (!uid || !lista || lista.tipo !== 'privada') return false;
        if (lista.donoUid === uid) return true;
        return (lista.participantes ?? []).some(p => p.uid === uid && p.role === 'editor');
    });

    readonly canEdit = computed(() => this.isEditorDaListaAtual() || this.isAdmin());

    readonly isParticipanteOuDonoListaAtual = computed(() => {
        const uid = this.auth.user()?.uid;
        const lista = this.listaAtual();
        if (!uid || !lista || lista.tipo !== 'privada') return false;
        if (lista.donoUid === uid) return true;
        return (lista.participantes ?? []).some(p => p.uid === uid);
    });

    readonly isControladorListaAtual = computed(() => {
        const uid = this.auth.user()?.uid;
        const lista = this.listaAtual();
        if (!uid || !lista) return false;
        if (lista.donoUid === uid) return true;
        return (lista.controladoresUids ?? []).includes(uid);
    });

    readonly musicasDaParte = computed<MusicaLista[]>(() => {
        const l = this.listaAtual();
        const p = this.parteAtiva();
        if (!l || !p) return [];
        return l.musicas.filter(m => m.parte === p).sort((a, b) => a.ordem - b.ordem);
    });

    modalBuscaAberto      = signal(false);
    adicionarMusicaAberto = signal(false);
    editandoTitulo        = signal(false);
    novoTitulo            = signal('');

    private listaSub?: Subscription;
    private salvandoLista = false;
    private tomSave$ = new Subject<Lista>();
    private tomSaveSub?: Subscription;
    private _obsTimers = new Map<string, ReturnType<typeof setTimeout>>();

    readonly CATEGORIAS_LABELS = this.config.categoriasLabels;

    ngOnInit(): void {
        this.tomSaveSub = this.tomSave$.pipe(
            debounceTime(500),
            switchMap(lista => this.listaService.salvarLista(lista)),
        ).subscribe({
            next: salva => this.listaAtual.set(salva),
            error: (err: Error) => this.notif.mostrarErro(err.message || 'Erro ao salvar tom.'),
        });

        const idParaCarregar = this.listaIdParam ?? localStorage.getItem(HomeComponent.STORAGE_KEY);
        if (idParaCarregar) {
            this.autoSelecionarComponente.set(false);
            if (this.listaIdParam) this.router.navigate([], { queryParams: {}, replaceUrl: true });
            this.listaService.getLista(idParaCarregar).subscribe(lista => {
                if (lista) {
                    this.selecionarLista(lista);
                    this.loading.set(false);
                } else {
                    localStorage.removeItem(HomeComponent.STORAGE_KEY);
                    this.autoSelecionarComponente.set(true);
                }
            });
        }
    }

    ngOnDestroy() {
        this.listaSub?.unsubscribe();
        this._obsTimers.forEach(t => clearTimeout(t));
        this.tomSaveSub?.unsubscribe();
    }

    // ── Seletor ────────────────────────────────────────────────────────

    abrirSeletor()  { this.seletorRef.abrir(); }
    abrirEdicao()   { this.editarRef.abrir(); }

    onListaEditada(lista: Lista) { this.listaAtual.set(lista); }

    iniciarEdicaoTitulo() {
        this.novoTitulo.set(this.listaAtual()?.titulo ?? '');
        this.editandoTitulo.set(true);
        setTimeout(() => this.tituloInputEl?.nativeElement.focus(), 0);
    }

    cancelarEdicaoTitulo() {
        this.editandoTitulo.set(false);
    }

    confirmarEdicaoTitulo() {
        const val = this.novoTitulo().trim();
        const lista = this.listaAtual();
        this.editandoTitulo.set(false);
        if (!val || !lista || val === lista.titulo) return;
        const atualizada = { ...lista, titulo: val };
        this.listaAtual.set(atualizada);
        this.salvarListaAtual(atualizada);
    }

    onListaSelecionada(lista: Lista) {
        this.selecionarLista(lista);
        this.loading.set(false);
    }

    onSemResultadoInicial() { this.loading.set(false); }

    selecionarLista(lista: Lista) {
        localStorage.setItem(HomeComponent.STORAGE_KEY, lista.id);
        this.listaSub?.unsubscribe();
        this.listaAtual.set(lista);
        if (lista.partes && lista.partes.length > 0) {
            this.parteAtiva.set(lista.partes[0].id);
        } else {
            const partes = this.config.partesIds().filter(p => lista.musicas.some(m => m.parte === p));
            this.parteAtiva.set(partes[0] ?? null);
        }
        if (lista.tipo === 'privada' && lista.id) {
            this.listaSub = this.listaService.escutarLista(lista.id).subscribe(nova => {
                if (!nova || this.salvandoLista) return;
                const atual = this.listaAtual();
                if (!atual || nova.atualizadaEm === atual.atualizadaEm) return;
                this.listaAtual.set(nova);
            });
        }
    }

    // ── Tabs ──────────────────────────────────────────────────────────

    onParteChange(parte: string) {
        this.parteAtiva.set(parte);
    }

    onTabsListaChange(lista: Lista) {
        this.salvarListaAtual(lista);
    }

    // ── Adicionar música ──────────────────────────────────────────────

    abrirAdicionarMusica() { this.adicionarMusicaAberto.set(true); }
    fecharAdicionarMusica() { this.adicionarMusicaAberto.set(false); }

    onMusicaAdicionada(selecionada: MusicaSelecionada) {
        const lista = this.listaAtual();
        if (!lista) return;
        const parte = this.parteAtiva();
        const novaMusica: MusicaLista = {
            id: `m-${Date.now()}`,
            cifraId: selecionada.cifraId,
            nome: selecionada.nome,
            autor: selecionada.autor,
            ...(selecionada.trecho !== undefined && { trecho: selecionada.trecho }),
            parte: parte ?? '',
            ordem: lista.musicas.filter(m => m.parte === parte).length,
        };
        const atualizada = { ...lista, musicas: [...lista.musicas, novaMusica] };
        this.listaAtual.set(atualizada);
        this.fecharAdicionarMusica();
        this.salvarListaAtual(atualizada);
        this.cifraService.atualizarListasIds(selecionada.cifraId, lista.id, 'add').subscribe();
        if (selecionada.cifra && lista.tipo === 'privada') {
            this.cifraService.salvarCifraEmLista(lista.id, selecionada.cifra).subscribe();
        }
    }

    onMusicaRemovida(musicaId: string) {
        const lista = this.listaAtual();
        if (!lista) return;
        const musicaRemovida = lista.musicas.find(m => m.id === musicaId);
        const atualizada = {
            ...lista,
            musicas: lista.musicas.filter(m => m.id !== musicaId).map((m, i) => ({ ...m, ordem: i })),
        };
        this.listaAtual.set(atualizada);
        this.salvarListaAtual(atualizada);
        if (musicaRemovida) {
            this.cifraService.atualizarListasIds(musicaRemovida.cifraId, lista.id, 'remove').subscribe();
        }
    }

    // ── Tom e observação ──────────────────────────────────────────────

    onTomAlterado({ musicaId, tom }: { musicaId: string; tom: string }) {
        const lista = this.listaAtual();
        if (!lista) return;
        const tomNovo = tom || undefined;
        const atualizada = {
            ...lista,
            musicas: lista.musicas.map(m => m.id === musicaId ? { ...m, tom: tomNovo } : m),
        };
        this.tomSave$.next(atualizada);
    }

    onObservacaoAlterada({ musicaId, obs }: { musicaId: string; obs: string }) {
        const lista = this.listaAtual();
        if (!lista) return;
        const atualizada = {
            ...lista,
            musicas: lista.musicas.map(m => m.id === musicaId ? { ...m, observacao: obs || undefined } : m),
        };
        this.listaAtual.set(atualizada);
        clearTimeout(this._obsTimers.get(musicaId));
        this._obsTimers.set(musicaId, setTimeout(() => {
            this.salvarListaAtual(this.listaAtual()!);
            this._obsTimers.delete(musicaId);
        }, 800));
    }

    // ── Live sync ─────────────────────────────────────────────────────

    onLiveSync(evento: LiveSyncEvent) {
        if (evento.musicaAbertaId !== null || evento.scrollY === null) {
            if (evento.parteAtiva) this.parteAtiva.set(evento.parteAtiva);
            this.acordeon?.sincronizarAberto(evento.musicaAbertaId);
        } else if (evento.scrollY != null) {
            window.scrollTo({ top: evento.scrollY, behavior: 'smooth' });
        }
    }

    onMusicaAbertaChanged(evento: { musicaId: string | null; parteId: string | null }) {
        this.liveCtrl?.notificarMusicaAberta(evento.musicaId, evento.parteId);
    }

    // ── Busca rápida ──────────────────────────────────────────────────

    abrirModalBusca()  { this.modalBuscaAberto.set(true); }
    fecharModalBusca() { this.modalBuscaAberto.set(false); }

    onMusicaBuscada(selecionada: MusicaSelecionada) {
        this.fecharModalBusca();
        this.router.navigate(['/cifra', selecionada.cifraId]);
    }

    // ── Save ──────────────────────────────────────────────────────────

    private salvarListaAtual(lista: Lista) {
        this.salvandoLista = true;
        this.listaService.salvarLista(lista).subscribe({
            next: salva => {
                this.salvandoLista = false;
                this.listaAtual.set(salva);
            },
            error: (err: Error) => {
                this.salvandoLista = false;
                this.notif.mostrarErro(err.message || 'Erro ao salvar lista.');
            },
        });
    }

    readonly formatarData = formatarDataLonga;

}
