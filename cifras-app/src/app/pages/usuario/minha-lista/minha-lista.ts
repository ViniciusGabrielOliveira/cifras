import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Lista, MusicaLista, ParteLista, RoleParticipante, TipoLista } from '../../../models/lista.model';
import { TONS } from '../../../core/cifra-parser';
import { ListaService } from '../../../services/lista.service';
import { CifraService } from '../../../services/cifra.service';
import { AuthService } from '../../../services/auth.service';
import { ConfigService } from '../../../services/config.service';
import { MusicaSearchComponent, MusicaSelecionada } from '../../../components/musica-search/musica-search';
import { AppSelectComponent } from '../../../components/app-select/app-select';
// CifraClubImportService mantido para futura restrição de acesso
import { CifraClubImportService } from '../../../services/cifraclub-import.service';

let _idCounter = Date.now();
function newId(prefix: string) { return `${prefix}-${++_idCounter}`; }

@Component({
    selector: 'app-minha-lista',
    standalone: true,
    imports: [CommonModule, FormsModule, MusicaSearchComponent, DragDropModule, AppSelectComponent],
    templateUrl: './minha-lista.html',
    styleUrl: './minha-lista.scss',
})
export class MinhaListaComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private listaService = inject(ListaService);
    private cifraService = inject(CifraService);
    readonly auth = inject(AuthService);
    private config = inject(ConfigService);
    private cifraClub = inject(CifraClubImportService);
    private destroyRef = inject(DestroyRef);

    get PARTES_LABELS() { return this.config.partesLabels(); }
    get PARTES_ORDER() { return this.config.partesIds(); }
    get CATEGORIAS_LABELS() { return this.config.categoriasLabels(); }
    get categorias() { return this.config.categoriasIds(); }

    // Contexto de rota e permissões
    adminContext = false; // true quando carregado via /admin/lista/:id
    readonly isAdmin = computed(() => this.auth.hasRole('admin'));
    readonly podeBuscarCifraClub = computed(() => this.adminContext || this.auth.hasRole('convidado'));

    lista = signal<Lista | null>(null);
    carregando = signal(true);
    notFound = signal(false);
    salvando = signal(false);
    notificacao = signal<string | null>(null);
    erroMsg = signal<string | null>(null);

    // Cifras que existem (para badge "cifra removida")
    cifrasExistentes = signal<Set<string>>(new Set());
    cifrasAutorMap   = signal<Map<string, string>>(new Map());

    readonly isDono = computed(() => {
        const uid = this.auth.user()?.uid;
        if (!uid) return false;
        if (this.adminContext && this.isAdmin()) return true;
        return uid === this.lista()?.donoUid;
    });

    readonly isEditor = computed(() => {
        const uid = this.auth.user()?.uid;
        if (!uid) return false;
        if (this.isDono()) return true;
        const participantes = this.lista()?.participantes ?? [];
        return participantes.some(p => p.uid === uid && p.role === 'editor');
    });

    readonly isControlador = computed(() => {
        const uid = this.auth.user()?.uid;
        if (!uid) return false;
        if (this.isDono()) return true;
        return this.lista()?.controladoresUids?.includes(uid) ?? false;
    });

    // Contagem de músicas personalizadas (para limite em listas privadas de usuário)
    totalMusicasCustom = signal(0);
    readonly LIMITE_MUSICAS = 25;
    readonly tons = TONS;
    readonly tonsOptions = TONS;
    readonly roleOptions = [
        { value: 'visualizador', label: 'Visualizador' },
        { value: 'editor', label: 'Editor' },
    ];
    readonly categoriasOptions = computed(() =>
        this.config.categoriasIds().map(id => ({ value: id, label: this.config.categoriasLabels()[id] ?? id }))
    );
    readonly podeAdicionarMusica = computed(() =>
        this.adminContext || this.totalMusicasCustom() < this.LIMITE_MUSICAS
    );

    // Modal busca música
    modalBuscaAberto = signal(false);
    parteParaAdicionar = signal('entrada');

    // Gerenciar partes (inline)
    editandoParteId = signal<string | null>(null);
    editandoParteLabel = signal('');

    readonly partesOrdem = computed((): ParteLista[] => {
        const lista = this.lista();
        if (!lista) return [];
        return lista.partes ?? this.PARTES_ORDER.map(id => ({ id }));
    });

    readonly partesDisponiveis = computed(() => {
        const lista = this.lista();
        if (!lista?.partes) return [];
        const emUso = new Set(lista.partes.map(p => p.id));
        return this.PARTES_ORDER.filter(p => !emUso.has(p));
    });

    parteLabel(parte: ParteLista): string {
        return parte.label ?? this.PARTES_LABELS[parte.id] ?? parte.id;
    }

    // Gerenciar participantes
    painelParticipantes = signal(false);
    linkConvite = signal('');
    linkCopiado = signal(false);
    confirmandoRemover = signal<string | null>(null);

    // Confirmação exclusão música
    confirmandoRemoverMusica = signal<string | null>(null);

    ngOnInit() {
        this.adminContext = this.route.snapshot.data['adminContext'] === true;

        const id = this.route.snapshot.paramMap.get('id') ?? '';
        if (!id) {
            this.router.navigate([this.adminContext ? '/admin/painel' : '/minha-area']);
            return;
        }

        // Carregar cifras existentes para badge "cifra removida"
        this.cifraService.getIndice()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(items => {
                this.cifrasExistentes.set(new Set(items.map(i => i.id)));
                this.cifrasAutorMap.set(new Map(items.map(i => [i.id, i.autor])));
            });

        const replaceCifraId = this.route.snapshot.queryParamMap.get('replaceCifraId');
        const newCifraId     = this.route.snapshot.queryParamMap.get('newCifraId');

        this.listaService.getLista(id).subscribe(lista => {
            if (lista) {
                let listaFinal = lista;
                if (replaceCifraId && newCifraId) {
                    this.mostrarNotificacao('Música salva como privada!');
                    this.router.navigate([], { queryParams: {}, replaceUrl: true });
                    const musicas = lista.musicas.map(m =>
                        m.cifraId === replaceCifraId ? { ...m, cifraId: newCifraId, privada: true } : m
                    );
                    listaFinal = { ...lista, musicas };
                    this.salvarLista(listaFinal);
                }
                this.lista.set(listaFinal);
                this.gerarLinkConvite(lista.tokenConvite);
            } else {
                this.notFound.set(true);
                setTimeout(() => this.router.navigate([this.adminContext ? '/admin/painel' : '/minha-area']), 2000);
            }
            this.carregando.set(false);
        });

        if (!this.adminContext) {
            const uid = this.auth.user()?.uid;
            if (uid) {
                this.cifraService.countCifrasDoUser(uid).subscribe(count => {
                    this.totalMusicasCustom.set(count);
                });
            }
        }

        // Retorno de nova-cifra/nova-musica
        const nomeCifra = this.route.snapshot.queryParamMap.get('nomeCifra');
        const cifraAdicionada = this.route.snapshot.queryParamMap.get('cifraAdicionada');
        const parteRetorno = this.route.snapshot.queryParamMap.get('parte') ?? 'entrada';
        if (nomeCifra) {
            this.mostrarNotificacao(`"${nomeCifra}" adicionada com sucesso!`);
            this.router.navigate([], { queryParams: {}, replaceUrl: true });
            if (cifraAdicionada) {
                this.listaService.getLista(id).subscribe(l => {
                    if (!l) return;
                    const novaMusica: MusicaLista = {
                        id: newId('m'),
                        cifraId: cifraAdicionada,
                        nome: nomeCifra,
                        autor: '',
                        parte: parteRetorno,
                        ordem: l.musicas.filter(m => m.parte === parteRetorno).length,
                        privada: !this.adminContext,
                    };
                    const atualizada = { ...l, musicas: [...l.musicas, novaMusica] };
                    this.lista.set(atualizada);
                    this.salvarLista(atualizada);
                });
            }
        }
    }

    private gerarLinkConvite(token?: string) {
        if (!token) return;
        const base = document.baseURI.replace(/\/$/, '');
        this.linkConvite.set(`${base}/join/${token}`);
    }

    autorDaCifra(musica: MusicaLista): string {
        return musica.autor || this.cifrasAutorMap().get(musica.cifraId) || '';
    }

    cifraExiste(cifraId: string, privada?: boolean): boolean {
        if (this.adminContext) return true;
        if (privada) return true; // cópia privada do usuário — sempre existe
        return this.cifrasExistentes().has(cifraId);
    }

    // ── Metadados da lista ────────────────────────────────────────────

    atualizarCampo<K extends keyof Lista>(campo: K, valor: Lista[K]) {
        const atual = this.lista();
        if (!atual) return;
        const atualizada = { ...atual, [campo]: valor };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
    }

    onTituloBlur(event: Event) {
        const val = (event.target as HTMLInputElement).value.trim();
        if (!val || val === this.lista()?.titulo) return;
        this.atualizarCampo('titulo', val);
    }

    onTodosDiasChange(todos: boolean) {
        const atual = this.lista();
        if (!atual) return;
        const atualizada: Lista = { ...atual, todosDias: todos || undefined };
        if (todos) {
            delete atualizada.dataInicio;
            delete atualizada.dataFim;
        }
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
    }

    onDataInicioChange(event: Event) {
        const val = (event.target as HTMLInputElement).value;
        this.atualizarCampo('dataInicio', val || undefined);
    }

    onDataFimChange(event: Event) {
        const val = (event.target as HTMLInputElement).value;
        this.atualizarCampo('dataFim', val || undefined);
    }

    onCategoriaChange(categoria: string) {
        this.atualizarCampo('categoria', categoria);
    }

    onTipoChange(tipo: TipoLista) {
        this.atualizarCampo('tipo', tipo);
    }

    // ── Músicas ───────────────────────────────────────────────────────

    musicasDaParte(parte: string): MusicaLista[] {
        return (this.lista()?.musicas ?? [])
            .filter(m => m.parte === parte)
            .sort((a, b) => a.ordem - b.ordem);
    }

    abrirModalBusca(parte: string) {
        this.parteParaAdicionar.set(parte);
        this.modalBuscaAberto.set(true);
    }

    fecharModalBusca() { this.modalBuscaAberto.set(false); }

    onMusicaSelecionada(selecionada: MusicaSelecionada) {
        const lista = this.lista();
        if (!lista) return;
        const novaMusica: MusicaLista = {
            id: newId('m'),
            cifraId: selecionada.cifraId,
            nome: selecionada.nome,
            autor: selecionada.autor,
            ...(selecionada.trecho !== undefined && { trecho: selecionada.trecho }),
            parte: this.parteParaAdicionar(),
            ordem: lista.musicas.filter(m => m.parte === this.parteParaAdicionar()).length,
        };
        const atualizada = { ...lista, musicas: [...lista.musicas, novaMusica] };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
        this.cifraService.atualizarListasIds(selecionada.cifraId, lista.id, 'add').subscribe();
        this.fecharModalBusca();
    }

    onCadastrarNova(nomeBuscado: string) {
        this.fecharModalBusca();
        const lista = this.lista();
        if (lista) {
            this.listaService.listaDraft = JSON.parse(JSON.stringify(lista));
            this.listaService.vistaDraft = 'editar-lista';
            this.listaService.parteParaAdicionarDraft = this.parteParaAdicionar();
        }
        if (this.adminContext) {
            this.router.navigate(['/admin/nova-cifra'], { queryParams: { nome: nomeBuscado } });
        } else {
            this.router.navigate(['/minha-area/nova-musica'], {
                queryParams: {
                    nome: nomeBuscado,
                    retornoLista: lista?.id,
                    parte: this.parteParaAdicionar(),
                },
            });
        }
    }


    removerMusica(musicaId: string) {
        const lista = this.lista();
        if (!lista) return;
        const musicaRemovida = lista.musicas.find(m => m.id === musicaId);
        const atualizada = {
            ...lista,
            musicas: lista.musicas.filter(m => m.id !== musicaId).map((m, i) => ({ ...m, ordem: i })),
        };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
        if (musicaRemovida) {
            this.cifraService.atualizarListasIds(musicaRemovida.cifraId, lista.id, 'remove').subscribe();
        }
        this.confirmandoRemoverMusica.set(null);
    }

    atualizarMusicaCampo(musicaId: string, campo: keyof MusicaLista, val: string) {
        const lista = this.lista();
        if (!lista) return;
        const atualizada = {
            ...lista,
            musicas: lista.musicas.map(m =>
                m.id === musicaId ? { ...m, [campo]: val || undefined } : m
            ),
        };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
    }

    onMusicasReorder(event: CdkDragDrop<MusicaLista[]>, parteId: string) {
        if (event.previousIndex === event.currentIndex) return;
        const lista = this.lista();
        if (!lista) return;
        const daParte = [...this.musicasDaParte(parteId)];
        moveItemInArray(daParte, event.previousIndex, event.currentIndex);
        const outras = lista.musicas.filter(m => m.parte !== parteId);
        const atualizada = {
            ...lista,
            musicas: [...outras, ...daParte.map((m, i) => ({ ...m, ordem: i }))],
        };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
    }

    editarMusica(musica: MusicaLista) {
        const lista = this.lista();
        if (lista) {
            this.listaService.listaDraft = JSON.parse(JSON.stringify(lista));
            this.listaService.vistaDraft = 'editar-lista';
        }
        if (this.adminContext) {
            this.router.navigate(['/admin/editar-cifra', musica.cifraId], {
                queryParams: { retorno: 'painel', edicaoCifra: 'true', retornoLista: lista?.id },
            });
        } else {
            this.router.navigate(['/minha-area/editar-musica', musica.cifraId], {
                queryParams: { retornoLista: lista?.id },
            });
        }
    }

    private salvarLista(lista: Lista) {
        this.salvando.set(true);
        this.listaService.salvarLista(lista).subscribe({
            next: () => this.salvando.set(false),
            error: (err: Error) => {
                this.salvando.set(false);
                this.mostrarErro(err.message || 'Erro ao salvar lista.');
            },
        });
    }

    // ── Partes (CRUD inline) ──────────────────────────────────────────

    iniciarEdicaoParte(parte: ParteLista) {
        this.editandoParteId.set(parte.id);
        this.editandoParteLabel.set(this.parteLabel(parte));
    }

    salvarLabelParte(parteId: string) {
        const lista = this.lista();
        if (!lista) return;
        const novoLabel = this.editandoParteLabel().trim();
        if (!novoLabel) { this.cancelarEdicaoParte(); return; }
        const partesAtuais = lista.partes ?? this.PARTES_ORDER.map(id => ({ id }));
        const atualizada = {
            ...lista,
            partes: partesAtuais.map(p => p.id === parteId ? { ...p, label: novoLabel } : p),
        };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
        this.editandoParteId.set(null);
    }

    cancelarEdicaoParte() { this.editandoParteId.set(null); }

    addParte(parteId: string) {
        const lista = this.lista();
        if (!lista) return;
        const partesAtuais = lista.partes ?? this.PARTES_ORDER.map(id => ({ id }));
        if (partesAtuais.some(p => p.id === parteId)) return;
        const atualizada = { ...lista, partes: [...partesAtuais, { id: parteId }] };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
    }

    removeParte(parteId: string) {
        const lista = this.lista();
        if (!lista) return;
        if (lista.musicas.some(m => m.parte === parteId)) return;
        const partesAtuais = lista.partes ?? this.PARTES_ORDER.map(id => ({ id }));
        const atualizada = { ...lista, partes: partesAtuais.filter(p => p.id !== parteId) };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
    }

    onPartesReorder(event: CdkDragDrop<ParteLista[]>) {
        if (event.previousIndex === event.currentIndex) return;
        const lista = this.lista();
        if (!lista) return;
        const partes = [...(lista.partes ?? this.PARTES_ORDER.map(id => ({ id })))];
        moveItemInArray(partes, event.previousIndex, event.currentIndex);
        const atualizada = { ...lista, partes };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
    }

    // ── Participantes ─────────────────────────────────────────────────

    abrirPainelParticipantes() { this.painelParticipantes.set(true); }
    fecharPainelParticipantes() { this.painelParticipantes.set(false); }

    copiarLink() {
        navigator.clipboard.writeText(this.linkConvite()).then(() => {
            this.linkCopiado.set(true);
            setTimeout(() => this.linkCopiado.set(false), 2000);
        });
    }

    onRoleChange(uid: string, value: string) {
        this.alterarRole(uid, value as RoleParticipante);
    }

    alterarRole(uid: string, role: RoleParticipante) {
        const listaId = this.lista()?.id;
        if (!listaId) return;
        this.listaService.atualizarRoleParticipante(listaId, uid, role).subscribe({
            next: () => {
                this.lista.update(l => {
                    if (!l) return l;
                    return {
                        ...l,
                        participantes: (l.participantes ?? []).map(p => p.uid === uid ? { ...p, role } : p),
                    };
                });
            },
            error: (err: Error) => this.mostrarErro(err.message || 'Erro ao alterar permissão.'),
        });
    }

    confirmarRemoverParticipante(uid: string) { this.confirmandoRemover.set(uid); }
    cancelarRemoverParticipante() { this.confirmandoRemover.set(null); }

    removerParticipante(uid: string) {
        const listaId = this.lista()?.id;
        if (!listaId) return;
        this.listaService.removerParticipante(listaId, uid).subscribe({
            next: () => {
                this.lista.update(l => {
                    if (!l) return l;
                    return {
                        ...l,
                        participantes: (l.participantes ?? []).filter(p => p.uid !== uid),
                    };
                });
                this.confirmandoRemover.set(null);
            },
            error: (err: Error) => {
                this.confirmandoRemover.set(null);
                this.mostrarErro(err.message || 'Erro ao remover participante.');
            },
        });
    }

    toggleControladoresUid(uid: string) {
        const lista = this.lista();
        if (!lista || !this.isDono()) return;
        const atuais = lista.controladoresUids ?? [];
        const novos = atuais.includes(uid) ? atuais.filter(u => u !== uid) : [...atuais, uid];
        this.listaService.atualizarControladoresUids(lista.id, novos).subscribe({
            next: () => this.lista.update(l => l ? { ...l, controladoresUids: novos } : l),
            error: (err: Error) => this.mostrarErro(err.message || 'Erro ao atualizar controladores.'),
        });
    }

    // ── Utils ─────────────────────────────────────────────────────────

    mostrarNotificacao(msg: string) {
        this.notificacao.set(msg);
        setTimeout(() => this.notificacao.set(null), 3000);
    }

    mostrarErro(msg: string) {
        this.erroMsg.set(msg);
        setTimeout(() => this.erroMsg.set(null), 5000);
    }

    voltar() {
        this.router.navigate([this.adminContext ? '/admin/painel' : '/minha-area']);
    }

    trackById(_: number, item: { id: string }) { return item.id; }
}
