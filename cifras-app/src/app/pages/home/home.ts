import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Lista, MusicaLista } from '../../models/lista.model';
import { ListaService } from '../../services/lista.service';
import { CifraService } from '../../services/cifra.service';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';
import { Cifra } from '../../models/cifra.model';
import { SecaoCifraComponent } from '../../components/secao-cifra/secao-cifra';
import { MusicaSearchComponent, MusicaSelecionada } from '../../components/musica-search/musica-search';
import { LiveService } from '../../services/live.service';
import { LiveEstado } from '../../models/live.model';
import { transporCifra } from '../../core/transposicao';

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
    cifraExpandida = computed<Cifra | null>(() => {
        const id = this.acordeonAberto();
        const map = this.cifrasCache();
        return id ? (map[id] ?? null) : null;
    });
    deltasTom = signal<Record<string, number>>({});
    fontesSize = signal<Record<string, number>>({});

    cifraTransposta = computed<Cifra | null>(() => {
        const c = this.cifraExpandida();
        if (!c) return null;
        const delta = this.deltasTom()[c.id] ?? 0;
        return transporCifra(c, delta);
    });

    // ── Labels (template) ────────────────────────────────────────────
    get CATEGORIAS_LABELS() { return this.config.categoriasLabels(); }
    get PARTES_MISSA_LABELS() { return this.config.partesLabels(); }
    get categories() { return this.config.categoriasIds().filter(id => id !== 'sem-categoria'); }

    ngOnInit(): void {
        this.carregarListasPorData(this.dataSelecionada());
    }

    ngOnDestroy() {
        this.liveSub?.unsubscribe();
        this.removerScrollHandler();
    }

    abrirCalendario() {
        this.mudarAba('dia');
        const input = this.inputData.nativeElement;
        if (input.showPicker) {
            input.showPicker();
        } else {
            input.click();
        }
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

    onDataChange(data: string) {
        this.dataSelecionada.set(data);
        this.carregarListasPorData(data);
    }

    onDataInputChange(event: Event) {
        const val = (event.target as HTMLInputElement).value;
        this.dataSelecionada.set(val);
        this.carregarListasPorData(val);
    }

    onCatChange(cat: string) {
        this.catSelecionada.set(cat);
        this.carregarListasPorCategoria(cat);
    }

    private carregarListasPorData(data: string) {
        this.loading.set(true);
        this.listaService.getListasDodia(data).subscribe(listas => {
            this.listasDoFiltro.set(listas);
            if (!this.listaAtual() && listas.length > 0) {
                this.selecionarLista(listas[0]);
            }
            this.loading.set(false);
        });
    }

    private carregarListasPorCategoria(cat: string) {
        this.listaService.getListasPorCategoria(cat).subscribe(listas => {
            this.listasDoFiltro.set(listas);
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
            this.carregarCifra(musica.cifraId);
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        }

        // Publicar no live se estiver no modo controlador
        if (this.modoControladorAtivo()) {
            const listaId = this.listaAtual()?.id;
            if (listaId) {
                this.liveService.atualizar(listaId, {
                    musicaAbertaId: jaAberta ? null : musica.id,
                    scrollY: jaAberta ? window.scrollY : 0,
                    ativo: true,
                    atualizadoPor: this.auth.user()?.uid ?? null,
                    parteAtiva: musica.parte,
                }).catch(() => {});
            }
        }
    }

    toggleMusicaFromBtn(musica: MusicaLista, btn: HTMLButtonElement) {
        const cardEl = btn.closest('.musica-card') as HTMLElement | null;
        this.toggleMusica(musica, cardEl ?? btn);
    }

    private carregarCifra(cifraId: string) {
        const cache = this.cifrasCache();
        if (cifraId in cache) return;
        this.cifrasCache.update(c => ({ ...c, [cifraId]: null }));
        this.cifraService.getCifra(cifraId).subscribe(cifra => {
            this.cifrasCache.update(c => ({ ...c, [cifraId]: cifra ?? null }));
        });
    }

    isCarregandoCifra(cifraId: string): boolean {
        const cache = this.cifrasCache();
        return cifraId in cache && cache[cifraId] === null;
    }

    getCifraDoCache(cifraId: string): Cifra | null {
        return this.cifrasCache()[cifraId] ?? null;
    }

    getCifraTransposta(cifra: Cifra): Cifra {
        const delta = this.deltasTom()[cifra.id] ?? 0;
        return transporCifra(cifra, delta);
    }

    mudarTom(cifraId: string, delta: number) {
        this.deltasTom.update(m => ({ ...m, [cifraId]: (m[cifraId] ?? 0) + delta }));
    }

    getDelta(cifraId: string): number {
        return this.deltasTom()[cifraId] ?? 0;
    }

    restaurarTom(cifraId: string) {
        this.deltasTom.update(m => ({ ...m, [cifraId]: 0 }));
    }

    getFonteSize(cifraId: string): number {
        return this.fontesSize()[cifraId] ?? 15;
    }

    mudarFonte(cifraId: string, delta: number) {
        this.fontesSize.update(m => {
            const atual = m[cifraId] ?? 15;
            return { ...m, [cifraId]: Math.min(24, Math.max(12, atual + delta)) };
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
                            this.carregarCifra(musica.cifraId);
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
                }).catch(() => {});
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
