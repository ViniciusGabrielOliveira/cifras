import { Component, inject, signal, computed, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Lista, MusicaLista } from '../../models/lista.model';
import { ListaService } from '../../services/lista.service';
import { CifraService } from '../../services/cifra.service';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';
import { Cifra, CifraVersao } from '../../models/cifra.model';
import { SecaoCifraComponent } from '../../components/secao-cifra/secao-cifra';
import { MusicaSearchComponent, MusicaSelecionada } from '../../components/musica-search/musica-search';
import { LiveService } from '../../services/live.service';
import { LiveEstado } from '../../models/live.model';
import { transporCifra, calcularDelta } from '../../core/transposicao';

let _idCounter = Date.now();
function newId(prefix: string) { return `${prefix}-${++_idCounter}`; }

type SeletorAba = 'dia' | 'categoria' | 'minhas-listas';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, SecaoCifraComponent, MusicaSearchComponent],
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

    @ViewChild('inputData') inputData!: ElementRef<HTMLInputElement>;

    // ── Seletor de lista ─────────────────────────────────────────────
    seletorAberta = signal(false);
    abaAtiva = signal<SeletorAba>('dia');
    dataSelecionada = signal(new Date().toISOString().split('T')[0]);
    catSelecionada = signal('tempo-comum');
    listasDoFiltro = signal<Lista[]>([]);
    minhasListas = signal<Lista[]>([]);
    carregandoMinhasListas = signal(false);
    carregandoFiltro = signal(false);

    // ── Lista atual ──────────────────────────────────────────────────
    listaAtual = signal<Lista | null>(null);
    loading = signal(true);

    // ── Tabs partes da missa ─────────────────────────────────────────
    partesDisponiveis = computed<string[]>(() => {
        const l = this.listaAtual();
        if (!l) return [];
        const usadas = new Set(l.musicas.map(m => m.parte));
        if (l.partes) {
            return l.partes.filter(p => usadas.has(p.id)).map(p => p.id);
        }
        return this.config.partesIds().filter(p => usadas.has(p));
    });
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
    readonly isEditorDaListaAtual = computed(() => {
        const uid = this.auth.user()?.uid;
        const lista = this.listaAtual();
        if (!uid || !lista || lista.tipo !== 'privada') return false;
        if (lista.donoUid === uid) return true;
        return (lista.participantes ?? []).some(p => p.uid === uid && p.role === 'editor');
    });

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

    // ── Modal adicionar música ───────────────────────────────────────
    modalAdicionarAberto = signal(false);
    salvandoMusica = signal(false);
    notificacaoHome = signal<string | null>(null);
    erroHome = signal<string | null>(null);

    // ── Accordion / Cifra ────────────────────────────────────────────
    acordeonAberto = signal<string | null>(null);
    cifrasCache = signal<Record<string, Cifra | null>>({});
    // keyed by musica.id (not cifraId) para suportar mesmo cifra com tons diferentes
    deltasTom = signal<Record<string, number>>({});
    fontesSize = signal<Record<string, number>>({});
    private deltasInicializados = new Set<string>();

    // ── Versões ──────────────────────────────────────────────────────
    // keyed by cifraId
    versoesCache = signal<Record<string, CifraVersao[]>>({});
    versoesSelecionadas = signal<Record<string, string | null>>({});

    // ── Labels (template) ────────────────────────────────────────────
    get CATEGORIAS_LABELS() { return this.config.categoriasLabels(); }
    get PARTES_MISSA_LABELS() { return this.config.partesLabels(); }
    get categories() { return this.config.categoriasIds().filter(id => id !== 'sem-categoria'); }

    ngOnInit(): void {
        const listaId = this.route.snapshot.queryParamMap.get('listaId');
        if (listaId) {
            this.router.navigate([], { queryParams: {}, replaceUrl: true });
            this.listaService.getLista(listaId).subscribe(lista => {
                if (lista) {
                    this.selecionarLista(lista);
                    this.abaAtiva.set('minhas-listas');
                }
                this.loading.set(false);
            });
        } else {
            this.carregarListasPorData(this.dataSelecionada());
        }
    }

    ngOnDestroy() {
        this.liveSub?.unsubscribe();
        this.removerScrollHandler();
    }

    // ─── Seletor ──────────────────────────────────────────────────────

    abrirSeletor() { this.seletorAberta.set(true); }
    fecharSeletor() { this.seletorAberta.set(false); }

    mudarAba(aba: SeletorAba) {
        this.abaAtiva.set(aba);
        if (aba === 'dia') {
            this.carregarListasPorData(this.dataSelecionada());
        } else if (aba === 'categoria') {
            this.carregarListasPorCategoria(this.catSelecionada());
        } else if (aba === 'minhas-listas') {
            this.carregarMinhasListas();
        }
    }

    onDataInputChange() {
        const input = this.inputData.nativeElement;
        input.addEventListener('change', (e: Event) => {
            const val = (e.target as HTMLInputElement).value;
            if (val) {
                this.dataSelecionada.set(val);
                this.abaAtiva.set('dia');
                this.carregarListasPorData(val);
            }
        }, { once: true });
        try { input.showPicker(); } catch { input.click(); }
    }

    onCatChange(cat: string) {
        this.catSelecionada.set(cat);
        this.carregarListasPorCategoria(cat);
    }

    private carregarListasPorData(data: string) {
        this.carregandoFiltro.set(true);
        this.listaService.getListasDodia(data).subscribe(listas => {
            this.listasDoFiltro.set(listas);
            if (!this.listaAtual() && listas.length > 0) {
                this.selecionarLista(listas[0]);
            }
            this.loading.set(false);
            this.carregandoFiltro.set(false);
        });
    }

    private carregarListasPorCategoria(cat: string) {
        this.carregandoFiltro.set(true);
        this.listaService.getListasPorCategoria(cat).subscribe(listas => {
            this.listasDoFiltro.set(listas);
            this.carregandoFiltro.set(false);
        });
    }

    private carregarMinhasListas() {
        const uid = this.auth.user()?.uid;
        if (!uid) return;
        this.carregandoMinhasListas.set(true);
        this.listaService.getTodasMinhasListas(uid).subscribe(listas => {
            this.minhasListas.set(listas);
            this.carregandoMinhasListas.set(false);
        });
    }

    selecionarLista(lista: Lista) {
        // Desligar live ao trocar de lista
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
        this.fecharSeletor();
    }

    // ─── Tabs ─────────────────────────────────────────────────────────

    selecionarParte(parte: string) {
        this.parteAtiva.set(parte);
        this.acordeonAberto.set(null);
    }

    // ─── Accordion ──────────────────────────────────────────────────

    toggleMusica(musica: MusicaLista, el: HTMLElement) {
        const jaAberta = this.acordeonAberto() === musica.id;
        this.acordeonAberto.set(jaAberta ? null : musica.id);

        if (!jaAberta) {
            this.carregarCifra(musica);
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
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

    private carregarCifra(musica: MusicaLista) {
        const { cifraId, id: musicaId, tom: tomAlvo } = musica;
        const cache = this.cifrasCache();
        if (cifraId in cache) {
            if (tomAlvo && cache[cifraId]) this.inicializarDelta(musicaId, cache[cifraId]!.tom, tomAlvo);
            return;
        }
        this.cifrasCache.update(c => ({ ...c, [cifraId]: null }));
        this.cifraService.getCifra(cifraId).subscribe(cifra => {
            this.cifrasCache.update(c => ({ ...c, [cifraId]: cifra ?? null }));
            if (cifra && tomAlvo) this.inicializarDelta(musicaId, cifra.tom, tomAlvo);
        });
        // Carrega versões arquivadas (fire-and-forget)
        if (!(cifraId in this.versoesCache())) {
            this.cifraService.getVersoes(cifraId).subscribe(versoes => {
                if (versoes.length > 0) {
                    this.versoesCache.update(v => ({ ...v, [cifraId]: versoes }));
                }
            });
        }
    }

    private inicializarDelta(musicaId: string, tomOriginal: string, tomAlvo: string) {
        if (this.deltasInicializados.has(musicaId)) return;
        this.deltasInicializados.add(musicaId);
        const delta = calcularDelta(tomOriginal, tomAlvo);
        if (delta !== 0) this.deltasTom.update(m => ({ ...m, [musicaId]: delta }));
    }

    isCarregandoCifra(cifraId: string): boolean {
        const cache = this.cifrasCache();
        return cifraId in cache && cache[cifraId] === null;
    }

    getCifraDoCache(cifraId: string): Cifra | null {
        return this.cifrasCache()[cifraId] ?? null;
    }

    getCifraTransposta(cifra: Cifra, musicaId: string): Cifra {
        const delta = this.deltasTom()[musicaId] ?? 0;
        return transporCifra(this.aplicarVersao(cifra), delta);
    }

    private aplicarVersao(cifra: Cifra): Cifra {
        const versaoId = this.versoesSelecionadas()[cifra.id];
        if (!versaoId) return cifra;
        const versao = (this.versoesCache()[cifra.id] ?? []).find(v => v.id === versaoId);
        return versao ? { ...cifra, secoes: versao.secoes, tom: versao.tom } : cifra;
    }

    getVersoes(cifraId: string): CifraVersao[] {
        return this.versoesCache()[cifraId] ?? [];
    }

    getVersaoSelecionada(cifraId: string): string | null {
        return this.versoesSelecionadas()[cifraId] ?? null;
    }

    selecionarVersao(cifraId: string, versaoId: string | null, musicaId: string) {
        this.versoesSelecionadas.update(v => ({ ...v, [cifraId]: versaoId }));
        // Reseta delta pois o tom base pode ser diferente entre versões
        this.deltasTom.update(m => ({ ...m, [musicaId]: 0 }));
        this.deltasInicializados.delete(musicaId);
    }

    formatarDataVersao(iso: string): string {
        return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
    }

    mudarTom(musicaId: string, delta: number) {
        this.deltasTom.update(m => ({ ...m, [musicaId]: (m[musicaId] ?? 0) + delta }));
    }

    getDelta(musicaId: string): number {
        return this.deltasTom()[musicaId] ?? 0;
    }

    restaurarTom(musicaId: string) {
        this.deltasTom.update(m => ({ ...m, [musicaId]: 0 }));
    }

    getFonteSize(musicaId: string): number {
        return this.fontesSize()[musicaId] ?? 15;
    }

    mudarFonte(musicaId: string, delta: number) {
        this.fontesSize.update(m => {
            const atual = m[musicaId] ?? 15;
            return { ...m, [musicaId]: Math.min(24, Math.max(12, atual + delta)) };
        });
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
                                // Mudar parte se necessário
                                if (this.parteAtiva() !== musica.parte) {
                                    this.parteAtiva.set(musica.parte);
                                }
                                this.acordeonAberto.set(idAberto);
                                this.carregarCifra(musica);
                                setTimeout(() => {
                                    const el = document.querySelector(`[data-musica-id="${idAberto}"]`) as HTMLElement | null;
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 150);
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

    // ─── Adicionar música (editor) ───────────────────────────────────

    abrirModalAdicionarMusica() { this.modalAdicionarAberto.set(true); }
    fecharModalAdicionarMusica() { this.modalAdicionarAberto.set(false); }

    onMusicaSelecionadaHome(selecionada: MusicaSelecionada) {
        const lista = this.listaAtual();
        const parte = this.parteAtiva();
        if (!lista || !parte) return;
        const novaMusica: MusicaLista = {
            id: newId('m'),
            cifraId: selecionada.cifraId,
            nome: selecionada.nome,
            autor: selecionada.autor,
            trecho: selecionada.trecho,
            parte,
            ordem: lista.musicas.filter(m => m.parte === parte).length,
        };
        const atualizada = { ...lista, musicas: [...lista.musicas, novaMusica] };
        this.listaAtual.set(atualizada);
        this.fecharModalAdicionarMusica();
        this.salvandoMusica.set(true);
        this.listaService.salvarLista(atualizada).subscribe({
            next: () => {
                this.salvandoMusica.set(false);
                this.mostrarNotificacaoHome(`"${selecionada.nome}" adicionada!`);
            },
            error: () => {
                this.salvandoMusica.set(false);
                this.listaAtual.set(lista);
            },
        });
    }

    onCadastrarNovaHome(nomeBuscado: string) {
        const lista = this.listaAtual();
        if (lista) {
            this.listaService.listaDraft = JSON.parse(JSON.stringify(lista));
            this.listaService.vistaDraft = 'editar-lista';
            this.listaService.parteParaAdicionarDraft = this.parteAtiva();
        }
        this.fecharModalAdicionarMusica();
        this.router.navigate(['/minha-area/nova-musica'], {
            queryParams: {
                nome: nomeBuscado,
                retornoLista: lista?.id,
                parte: this.parteAtiva(),
            },
        });
    }

    private mostrarNotificacaoHome(msg: string) {
        this.notificacaoHome.set(msg);
        setTimeout(() => this.notificacaoHome.set(null), 3000);
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
