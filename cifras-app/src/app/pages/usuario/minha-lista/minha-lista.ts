import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Lista, MusicaLista, Participante, RoleParticipante } from '../../../models/lista.model';
import { ListaService } from '../../../services/lista.service';
import { CifraService } from '../../../services/cifra.service';
import { AuthService } from '../../../services/auth.service';
import { ConfigService } from '../../../services/config.service';
import { MusicaSearchComponent, MusicaSelecionada } from '../../../components/musica-search/musica-search';

let _idCounter = Date.now();
function newId(prefix: string) { return `${prefix}-${++_idCounter}`; }

@Component({
    selector: 'app-minha-lista',
    standalone: true,
    imports: [CommonModule, FormsModule, MusicaSearchComponent],
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

    get PARTES_LABELS() { return this.config.partesLabels(); }
    get PARTES_ORDER() { return this.config.partesIds(); }

    lista = signal<Lista | null>(null);
    carregando = signal(true);
    notFound = signal(false);
    salvando = signal(false);
    notificacao = signal<string | null>(null);
    erroMsg = signal<string | null>(null);

    readonly isDono = computed(() => {
        const uid = this.auth.user()?.uid;
        return uid && this.lista()?.donoUid === uid;
    });

    readonly isEditor = computed(() => {
        const uid = this.auth.user()?.uid;
        if (!uid) return false;
        if (this.isDono()) return true;
        const participantes = this.lista()?.participantes ?? [];
        return participantes.some(p => p.uid === uid && p.role === 'editor');
    });

    // Contagem de músicas personalizadas do usuário (para limite)
    totalMusicasCustom = signal(0);
    readonly LIMITE_MUSICAS = 25;
    readonly podeAdicionarMusica = computed(() => this.totalMusicasCustom() < this.LIMITE_MUSICAS);

    // Modal busca música
    modalBuscaAberto = signal(false);
    parteParaAdicionar = signal('entrada');

    // Gerenciar participantes
    painelParticipantes = signal(false);
    linkConvite = signal('');
    linkCopiado = signal(false);
    confirmandoRemover = signal<string | null>(null);

    // Confirmação exclusão música
    confirmandoRemoverMusica = signal<string | null>(null);

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id') ?? '';
        if (!id) { this.router.navigate(['/minha-area']); return; }

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
                setTimeout(() => this.router.navigate(['/minha-area']), 2000);
            }
            this.carregando.set(false);
        });

        const uid = this.auth.user()?.uid;
        if (uid) {
            this.cifraService.countCifrasDoUser(uid).subscribe(count => {
                this.totalMusicasCustom.set(count);
            });
        }

        // Retorno de nova-cifra
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
                        privada: true,
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
        this.linkConvite.set(`${window.location.origin}/join/${token}`);
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
            trecho: selecionada.trecho,
            parte: this.parteParaAdicionar(),
            ordem: lista.musicas.filter(m => m.parte === this.parteParaAdicionar()).length,
        };
        const atualizada = { ...lista, musicas: [...lista.musicas, novaMusica] };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
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
        this.router.navigate(['/minha-area/nova-musica'], {
            queryParams: {
                nome: nomeBuscado,
                retornoLista: this.lista()?.id,
                parte: this.parteParaAdicionar(),
            },
        });
    }

    removerMusica(musicaId: string) {
        const lista = this.lista();
        if (!lista) return;
        const atualizada = {
            ...lista,
            musicas: lista.musicas.filter(m => m.id !== musicaId).map((m, i) => ({ ...m, ordem: i })),
        };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
        this.confirmandoRemoverMusica.set(null);
    }

    moverMusica(musicaId: string, dir: -1 | 1) {
        const lista = this.lista();
        if (!lista) return;
        const musicas = [...lista.musicas];
        const idx = musicas.findIndex(m => m.id === musicaId);
        const novoIdx = idx + dir;
        if (novoIdx < 0 || novoIdx >= musicas.length) return;
        [musicas[idx], musicas[novoIdx]] = [musicas[novoIdx], musicas[idx]];
        const atualizada = { ...lista, musicas: musicas.map((m, i) => ({ ...m, ordem: i })) };
        this.lista.set(atualizada);
        this.salvarLista(atualizada);
    }

    editarMusica(musica: MusicaLista) {
        const lista = this.lista();
        if (lista) {
            this.listaService.listaDraft = JSON.parse(JSON.stringify(lista));
            this.listaService.vistaDraft = 'editar-lista';
        }
        this.router.navigate(['/minha-area/editar-musica', musica.cifraId], {
            queryParams: { retornoLista: lista?.id },
        });
    }

    verCifra(cifraId: string) {
        this.router.navigate(['/cifra', cifraId]);
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

    // ── Participantes ─────────────────────────────────────────────────

    abrirPainelParticipantes() { this.painelParticipantes.set(true); }
    fecharPainelParticipantes() { this.painelParticipantes.set(false); }

    copiarLink() {
        navigator.clipboard.writeText(this.linkConvite()).then(() => {
            this.linkCopiado.set(true);
            setTimeout(() => this.linkCopiado.set(false), 2000);
        });
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

    // ── Utils ─────────────────────────────────────────────────────────

    mostrarNotificacao(msg: string) {
        this.notificacao.set(msg);
        setTimeout(() => this.notificacao.set(null), 3000);
    }

    mostrarErro(msg: string) {
        this.erroMsg.set(msg);
        setTimeout(() => this.erroMsg.set(null), 5000);
    }

    voltar() { this.router.navigate(['/minha-area']); }

    trackById(_: number, item: { id: string }) { return item.id; }
}
