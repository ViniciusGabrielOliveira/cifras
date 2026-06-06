import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Lista } from '../../../models/lista.model';
import { ListaService } from '../../../services/lista.service';
import { CifraService } from '../../../services/cifra.service';
import { AuthService } from '../../../services/auth.service';
import { ParticipantesListaComponent } from '../../../components/participantes-lista/participantes-lista';
import { ListaMetadataComponent } from '../../../components/lista-metadata/lista-metadata';
import { MusicasListaComponent } from '../../../components/musicas-lista/musicas-lista';
import { newId } from '../../../utils/id.utils';
import { NotificationService } from '../../../services/notification.service';
import { TONS } from '../../../core/cifra-parser';

@Component({
    selector: 'app-minha-lista',
    standalone: true,
    imports: [ParticipantesListaComponent, ListaMetadataComponent, MusicasListaComponent],
    templateUrl: './minha-lista.html',
    styleUrl: './minha-lista.scss',
})
export class MinhaListaComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private listaService = inject(ListaService);
    private cifraService = inject(CifraService);
    readonly auth = inject(AuthService);
    readonly notif = inject(NotificationService);

    adminContext = false;
    readonly isAdmin = computed(() => this.auth.hasRole('admin'));
    readonly podeBuscarCifraClub = computed(() => this.adminContext || this.auth.hasRole('convidado'));

    lista = signal<Lista | null>(null);
    carregando = signal(true);
    notFound = signal(false);
    salvando = signal(false);

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
        return (this.lista()?.participantes ?? []).some(p => p.uid === uid && p.role === 'editor');
    });

    totalMusicasCustom = signal(0);
    readonly LIMITE_MUSICAS = 25;
    readonly tons = TONS;

    readonly podeAdicionarMusica = computed(() =>
        this.adminContext || this.totalMusicasCustom() < this.LIMITE_MUSICAS
    );

    painelParticipantes = signal(false);

    ngOnInit() {
        this.adminContext = this.route.snapshot.data['adminContext'] === true;

        const id = this.route.snapshot.paramMap.get('id') ?? '';
        if (!id) {
            this.router.navigate([this.adminContext ? '/admin/painel' : '/minha-area']);
            return;
        }

        const replaceCifraId = this.route.snapshot.queryParamMap.get('replaceCifraId');
        const newCifraId     = this.route.snapshot.queryParamMap.get('newCifraId');

        this.listaService.getLista(id).subscribe(lista => {
            if (lista) {
                let listaFinal = lista;
                if (replaceCifraId && newCifraId) {
                    this.notif.mostrar('Música salva como privada!');
                    this.router.navigate([], { queryParams: {}, replaceUrl: true });
                    const musicas = lista.musicas.map(m =>
                        m.cifraId === replaceCifraId ? { ...m, cifraId: newCifraId, privada: true } : m
                    );
                    listaFinal = { ...lista, musicas };
                    this.listaService.salvarLista(listaFinal).subscribe();
                }
                this.lista.set(listaFinal);
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

        const nomeCifra = this.route.snapshot.queryParamMap.get('nomeCifra');
        const cifraAdicionada = this.route.snapshot.queryParamMap.get('cifraAdicionada');
        const parteRetorno = this.route.snapshot.queryParamMap.get('parte') ?? 'entrada';
        if (nomeCifra) {
            this.notif.mostrar(`"${nomeCifra}" adicionada com sucesso!`);
            this.router.navigate([], { queryParams: {}, replaceUrl: true });
            if (cifraAdicionada) {
                this.listaService.getLista(id).subscribe(l => {
                    if (!l) return;
                    const novaMusica = {
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
                    this.listaService.salvarLista(atualizada).subscribe();
                });
            }
        }
    }

    onMetadataListaChanged(atualizada: Lista) {
        this.lista.set(atualizada);
        this.listaService.salvarLista(atualizada).subscribe({
            error: (err: Error) => this.notif.mostrarErro(err.message || 'Erro ao salvar.'),
        });
    }

    onMusicasListaChange(atualizada: Lista) { this.lista.set(atualizada); }
    onSalvandoChange(salvando: boolean) { this.salvando.set(salvando); }

    abrirPainelParticipantes() { this.painelParticipantes.set(true); }
    fecharPainelParticipantes() { this.painelParticipantes.set(false); }

    onParticipantesListaAtualizada(atualizada: Lista) { this.lista.set(atualizada); }

    voltar() {
        this.router.navigate([this.adminContext ? '/admin/painel' : '/minha-area']);
    }
}
