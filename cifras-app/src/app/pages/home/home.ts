import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Lista, MusicaLista, ParteLista } from '../../models/lista.model';
import { ListaService } from '../../services/lista.service';
import { CifraService } from '../../services/cifra.service';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';
import { Cifra, CifraVersao } from '../../models/cifra.model';
import { CifraViewerComponent } from '../../components/cifra-viewer/cifra-viewer';
import { MusicaSearchComponent, MusicaSelecionada } from '../../components/musica-search/musica-search';
import { SeletorRepertorioComponent } from '../../components/seletor-repertorio/seletor-repertorio';
import { EditarListaSheetComponent } from '../../components/editar-lista-sheet/editar-lista-sheet';
import { LiveService } from '../../services/live.service';
import { LiveEstado } from '../../models/live.model';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterLink, CifraViewerComponent, MusicaSearchComponent, SeletorRepertorioComponent, EditarListaSheetComponent],
    templateUrl: './home.html',
    styleUrl: './home.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
    private listaService = inject(ListaService);
    private cifraService = inject(CifraService);
    private liveService = inject(LiveService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    readonly config = inject(ConfigService);
    readonly auth = inject(AuthService);

    @ViewChild(SeletorRepertorioComponent) seletorRef!: SeletorRepertorioComponent;
    @ViewChild(EditarListaSheetComponent) editarRef!: EditarListaSheetComponent;

    readonly listaIdParam = this.route.snapshot.queryParamMap.get('listaId');

    // ── Lista atual ──────────────────────────────────────────────────
    listaAtual = signal<Lista | null>(null);
    loading = signal(true);

    // ── Tabs partes da missa ─────────────────────────────────────────
    partesDisponiveis = computed<string[]>(() => {
        const l = this.listaAtual();
        if (!l) return [];
        if (l.partes) {
            // Listas com partes customizadas: mostra todas, mesmo sem música
            return l.partes.map(p => p.id);
        }
        const usadas = new Set(l.musicas.map(m => m.parte));
        return this.config.partesIds().filter(p => usadas.has(p));
    });

    readonly partesParaAdicionar = computed<{ id: string; label: string }[]>(() => {
        const lista = this.listaAtual();
        if (!lista) return [];
        const emUso = new Set(lista.partes?.map(p => p.id) ?? lista.musicas.map(m => m.parte));
        return this.config.partesIds()
            .filter(id => !emUso.has(id))
            .map(id => ({ id, label: this.config.partesLabels()[id] ?? id }));
    });

    readonly opcoesFiltradas = computed(() => {
        const busca = this.buscaParte().toLowerCase().trim();
        if (!busca) return this.partesParaAdicionar();
        return this.partesParaAdicionar().filter(p => p.label.toLowerCase().includes(busca));
    });

    readonly mostrarCriarParte = computed(() => {
        const busca = this.buscaParte().trim();
        if (!busca) return false;
        return !this.partesParaAdicionar().some(p => p.label.toLowerCase() === busca.toLowerCase());
    });

    adicionandoParte           = signal(false);
    buscaParte                 = signal('');
    adicionarMusicaAberto      = signal(false);
    parteParaAdicionarMusica   = signal('');
    confirmandoRemoverMusica   = signal<string | null>(null);

    parteAtiva = signal<string | null>(null);

    parteLabel(parteId: string): string {
        const parteLista = this.listaAtual()?.partes?.find(p => p.id === parteId);
        return parteLista?.label ?? this.config.partesLabels()[parteId] ?? parteId;
    }

    musicasDaParte = computed<MusicaLista[]>(() => {
        const l = this.listaAtual();
        const p = this.parteAtiva();
        if (!l || !p) return [];
        return l.musicas
            .filter(m => m.parte === p)
            .sort((a, b) => a.ordem - b.ordem);
    });

    // ── Permissão de edição na lista atual ──────────────────────────
    readonly isAdmin = computed(() => this.auth.hasRole('admin'));

    readonly isEditorDaListaAtual = computed(() => {
        const uid = this.auth.user()?.uid;
        const lista = this.listaAtual();
        if (!uid || !lista || lista.tipo !== 'privada') return false;
        if (lista.donoUid === uid) return true;
        return (lista.participantes ?? []).some(p => p.uid === uid && p.role === 'editor');
    });

    readonly canEdit = computed(() => this.isEditorDaListaAtual() || this.isAdmin());

    // ── Live mode: quem pode ver os toggles ──────────────────────────
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

    // ── Live mode: state ─────────────────────────────────────────────
    modoLiveAtivo = signal(false);
    modoControladorAtivo = signal(false);
    liveEstado = signal<LiveEstado | null>(null);

    private liveSub?: Subscription;
    private scrollHandler?: EventListener;
    private lastSyncedMusicaId: string | null = null;

    // ── Modal busca rápida ───────────────────────────────────────────
    modalBuscaAberto = signal(false);
    erroHome = signal<string | null>(null);

    // ── Accordion / Cifra ────────────────────────────────────────────
    acordeonAberto = signal<string | null>(null);
    cifrasCache = signal<Record<string, Cifra | null>>({});

    // ── Versões ──────────────────────────────────────────────────────
    versoesCache = signal<Record<string, CifraVersao[]>>({});

    // ── Labels (template) ────────────────────────────────────────────
    get CATEGORIAS_LABELS() { return this.config.categoriasLabels(); }
    get PARTES_MISSA_LABELS() { return this.config.partesLabels(); }
    get categories() { return this.config.categoriasIds().filter(id => id !== 'sem-categoria'); }

    ngOnInit(): void {
        if (this.listaIdParam) {
            this.router.navigate([], { queryParams: {}, replaceUrl: true });
            this.listaService.getLista(this.listaIdParam).subscribe(lista => {
                if (lista) this.selecionarLista(lista);
                this.loading.set(false);
            });
        }
        // else: SeletorRepertorioComponent carrega hoje e emite via (listaSelecionada)
    }

    ngOnDestroy() {
        this.liveSub?.unsubscribe();
        this.removerScrollHandler();
    }

    // ── Seletor ───────────────────────────────────────────────────────

    abrirSeletor() { this.seletorRef.abrir(); }
    abrirEdicao()  { this.editarRef.abrir(); }

    onListaEditada(lista: Lista) { this.listaAtual.set(lista); }

    onListaSelecionada(lista: Lista) {
        this.selecionarLista(lista);
        this.loading.set(false);
    }

    onSemResultadoInicial() {
        this.loading.set(false);
    }

    selecionarLista(lista: Lista) {
        if (this.modoLiveAtivo()) {
            this.liveSub?.unsubscribe();
            this.liveSub = undefined;
            this.liveEstado.set(null);
            this.modoLiveAtivo.set(false);
            this.modoControladorAtivo.set(false);
            this.removerScrollHandler();
            this.lastSyncedMusicaId = null;
        }
        this.listaAtual.set(lista);
        this.acordeonAberto.set(null);
        const partes = this.config.partesIds().filter(p => lista.musicas.some(m => m.parte === p));
        this.parteAtiva.set(partes[0] ?? null);
    }

    // ─── Tabs ─────────────────────────────────────────────────────────

    selecionarParte(parte: string) {
        this.parteAtiva.set(parte);
        this.acordeonAberto.set(null);
    }

    toggleAdicionarParte() {
        const novo = !this.adicionandoParte();
        this.adicionandoParte.set(novo);
        this.buscaParte.set('');
        if (novo) setTimeout(() => {
            (document.querySelector('.parte-autocomplete-input') as HTMLInputElement)?.focus();
        }, 30);
    }

    addParte(parteId: string) {
        const lista = this.listaAtual();
        if (!lista) return;
        const partesAtuais: ParteLista[] = lista.partes
            ?? [...new Set(lista.musicas.map(m => m.parte))].map(id => ({ id }));
        if (partesAtuais.some(p => p.id === parteId)) return;
        const atualizada = { ...lista, partes: [...partesAtuais, { id: parteId }] };
        this.listaAtual.set(atualizada);
        this.parteAtiva.set(parteId);
        this.adicionandoParte.set(false);
        this.buscaParte.set('');
        this.salvarListaAtual(atualizada);
    }

    addPartePersonalizada(label: string) {
        const lista = this.listaAtual();
        if (!lista || !label.trim()) return;
        const id = `parte-${Date.now()}`;
        const partesAtuais: ParteLista[] = lista.partes
            ?? [...new Set(lista.musicas.map(m => m.parte))].map(id => ({ id }));
        const atualizada = { ...lista, partes: [...partesAtuais, { id, label: label.trim() }] };
        this.listaAtual.set(atualizada);
        this.parteAtiva.set(id);
        this.adicionandoParte.set(false);
        this.buscaParte.set('');
        this.salvarListaAtual(atualizada);
    }

    parteVazia(parteId: string): boolean {
        return !(this.listaAtual()?.musicas.some(m => m.parte === parteId) ?? false);
    }

    removeParte(parteId: string) {
        const lista = this.listaAtual();
        if (!lista?.partes || lista.musicas.some(m => m.parte === parteId)) return;
        const atualizada = { ...lista, partes: lista.partes.filter(p => p.id !== parteId) };
        this.listaAtual.set(atualizada);
        if (this.parteAtiva() === parteId) {
            this.parteAtiva.set(atualizada.partes[0]?.id ?? null);
        }
        this.salvarListaAtual(atualizada);
    }

    onParteBuscaEnter() {
        const opcoes = this.opcoesFiltradas();
        if (opcoes.length > 0) {
            this.addParte(opcoes[0].id);
        } else {
            const busca = this.buscaParte().trim();
            if (busca) this.addPartePersonalizada(busca);
        }
    }

    // ─── Adicionar música ────────────────────────────────────────────

    abrirAdicionarMusica(parte: string | null) {
        if (!parte) return;
        this.parteParaAdicionarMusica.set(parte);
        this.adicionarMusicaAberto.set(true);
    }

    fecharAdicionarMusica() { this.adicionarMusicaAberto.set(false); }

    onMusicaAdicionada(selecionada: MusicaSelecionada) {
        const lista = this.listaAtual();
        if (!lista) return;
        const parte = this.parteParaAdicionarMusica();
        const novaMusica: MusicaLista = {
            id: `m-${Date.now()}`,
            cifraId: selecionada.cifraId,
            nome: selecionada.nome,
            autor: selecionada.autor,
            trecho: selecionada.trecho,
            parte,
            ordem: lista.musicas.filter(m => m.parte === parte).length,
        };
        const atualizada = { ...lista, musicas: [...lista.musicas, novaMusica] };
        this.listaAtual.set(atualizada);
        this.fecharAdicionarMusica();
        this.salvarListaAtual(atualizada);
    }

    removerMusica(musicaId: string) {
        const lista = this.listaAtual();
        if (!lista) return;
        const atualizada = {
            ...lista,
            musicas: lista.musicas
                .filter(m => m.id !== musicaId)
                .map((m, i) => ({ ...m, ordem: i })),
        };
        this.listaAtual.set(atualizada);
        this.confirmandoRemoverMusica.set(null);
        if (this.acordeonAberto() === musicaId) this.acordeonAberto.set(null);
        this.salvarListaAtual(atualizada);
    }

    private salvarListaAtual(lista: Lista) {
        this.listaService.salvarLista(lista).subscribe({
            next: salva => this.listaAtual.set(salva),
        });
    }

    // ─── Accordion ──────────────────────────────────────────────────

    toggleMusica(musica: MusicaLista, el: HTMLElement) {
        const jaAberta = this.acordeonAberto() === musica.id;
        this.acordeonAberto.set(jaAberta ? null : musica.id);

        if (!jaAberta) {
            this.carregarCifra(musica, () => {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        if (this.modoControladorAtivo()) {
            const listaId = this.listaAtual()?.id;
            if (listaId) {
                this.liveService.atualizar(listaId, {
                    musicaAbertaId: jaAberta ? null : musica.id,
                    scrollY: jaAberta ? window.scrollY : 0,
                    ativo: true,
                    atualizadoPor: this.auth.user()?.uid ?? null,
                    parteAtiva: musica.parte,
                }).catch(() => { });
            }
        }
    }

    toggleMusicaFromBtn(musica: MusicaLista, btn: HTMLButtonElement) {
        const cardEl = btn.closest('.musica-card') as HTMLElement | null;
        this.toggleMusica(musica, cardEl ?? btn);
    }

    private carregarCifra(musica: MusicaLista, onCarregado?: () => void) {
        const { cifraId } = musica;
        const cache = this.cifrasCache();

        if (cifraId in cache) {
            if (onCarregado) requestAnimationFrame(() => requestAnimationFrame(onCarregado));
            return;
        }

        this.cifrasCache.update(c => ({ ...c, [cifraId]: null }));
        this.cifraService.getCifra(cifraId).subscribe(cifra => {
            this.cifrasCache.update(c => ({ ...c, [cifraId]: cifra ?? null }));
            if (onCarregado) requestAnimationFrame(() => requestAnimationFrame(onCarregado));
        });

        if (!(cifraId in this.versoesCache())) {
            this.cifraService.getVersoes(cifraId).subscribe(versoes => {
                if (versoes.length > 0) {
                    this.versoesCache.update(v => ({ ...v, [cifraId]: versoes }));
                }
            });
        }
    }

    isCarregandoCifra(cifraId: string): boolean {
        const cache = this.cifrasCache();
        return cifraId in cache && cache[cifraId] === null;
    }

    getCifraDoCache(cifraId: string): Cifra | null {
        return this.cifrasCache()[cifraId] ?? null;
    }

    getVersoes(cifraId: string): CifraVersao[] {
        return this.versoesCache()[cifraId] ?? [];
    }

    // ─── Live mode ────────────────────────────────────────────────────

    toggleLive() {
        const novo = !this.modoLiveAtivo();
        this.modoLiveAtivo.set(novo);
        if (novo) {
            const listaId = this.listaAtual()?.id;
            if (!listaId) return;
            this.liveSub = this.liveService.getEstado(listaId).subscribe({
                error: (err: unknown) => {
                    console.error('[Live] erro ao conectar:', err);
                    this.modoLiveAtivo.set(false);
                    this.modoControladorAtivo.set(false);
                    this.liveEstado.set(null);
                    this.removerScrollHandler();
                    const msg = (err instanceof Error && err.message.includes('permission'))
                        ? 'Sem permissão para acessar o live. Verifique se você é participante da lista.'
                        : 'Não foi possível conectar ao modo live. Tente novamente.';
                    this.mostrarErroHome(msg);
                },
                next: (estado) => {
                    this.liveEstado.set(estado);
                    if (this.modoControladorAtivo()) return;

                    const idAberto = estado?.musicaAbertaId ?? null;
                    const musicaMudou = idAberto !== this.lastSyncedMusicaId;
                    this.lastSyncedMusicaId = idAberto;

                    if (musicaMudou) {
                        if (idAberto) {
                            const musica = this.listaAtual()?.musicas.find(m => m.id === idAberto);
                            if (musica) {
                                if (this.parteAtiva() !== musica.parte) {
                                    this.parteAtiva.set(musica.parte);
                                }
                                this.acordeonAberto.set(idAberto);
                                this.carregarCifra(musica, () => {
                                    const el = document.querySelector(`[data-musica-id="${idAberto}"]`) as HTMLElement | null;
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                });
                            }
                        } else {
                            this.acordeonAberto.set(null);
                        }
                    } else if (estado?.scrollY != null) {
                        window.scrollTo({ top: estado.scrollY, behavior: 'smooth' });
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
            const listaId = this.listaAtual()?.id;
            if (listaId) {
                this.liveService.atualizar(listaId, {
                    ativo: true,
                    atualizadoPor: this.auth.user()?.uid ?? null,
                    musicaAbertaId: this.acordeonAberto(),
                    scrollY: window.scrollY,
                    parteAtiva: this.parteAtiva(),
                }).catch(() => { });
            }
        } else {
            this.removerScrollHandler();
        }
    }

    private instalarScrollHandler() {
        this.removerScrollHandler();
        const listaId = this.listaAtual()?.id;
        if (!listaId) return;
        let t: ReturnType<typeof setTimeout>;
        this.scrollHandler = () => {
            clearTimeout(t);
            t = setTimeout(() => {
                this.liveService.atualizar(listaId, { scrollY: window.scrollY }).catch(() => { });
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

    // ─── Busca rápida ────────────────────────────────────────────────

    abrirModalBusca()  { this.modalBuscaAberto.set(true); }
    fecharModalBusca() { this.modalBuscaAberto.set(false); }

    onMusicaBuscada(selecionada: MusicaSelecionada) {
        this.fecharModalBusca();
        this.router.navigate(['/cifra', selecionada.cifraId]);
    }

    private mostrarErroHome(msg: string) {
        this.erroHome.set(msg);
        setTimeout(() => this.erroHome.set(null), 5000);
    }

    // ─── Helpers de data ─────────────────────────────────────────────

    formatarData(iso?: string): string {
        if (!iso) return '';
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        });
    }

    dataHoje(): string {
        return new Date().toISOString().split('T')[0];
    }
}
