import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Lista, TipoLista } from '../../../models/lista.model';
import { ListaService } from '../../../services/lista.service';
import { CifraService } from '../../../services/cifra.service';
import { AuthService } from '../../../services/auth.service';
import { ConfigService } from '../../../services/config.service';
import { AppSelectComponent } from '../../../components/app-select/app-select';

let _idCounter = Date.now();
function newId(prefix: string) { return `${prefix}-${++_idCounter}`; }

@Component({
    selector: 'app-minha-area',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, AppSelectComponent],
    templateUrl: './minha-area.html',
    styleUrl: './minha-area.scss',
})
export class MinhaAreaComponent implements OnInit {
    private listaService = inject(ListaService);
    private cifraService = inject(CifraService);
    readonly auth = inject(AuthService);
    private router = inject(Router);
    readonly config = inject(ConfigService);

    get categorias() { return this.config.categoriasIds(); }
    get categoriasLabels() { return this.config.categoriasLabels(); }
    readonly categoriasOptions = computed(() =>
        this.config.categoriasIds().map(id => ({ value: id, label: this.config.categoriasLabels()[id] ?? id }))
    );

    minhasListas = signal<Lista[]>([]);
    totalMusicasCustom = signal(0);
    carregando = signal(true);

    // Estado de criação/edição de lista
    criandoLista = signal(false);
    novaListaTitulo = signal('');
    novaListaCategoria = signal('tempo-comum');
    salvandoLista = signal(false);

    confirmandoExclusao = signal<string | null>(null);

    notificacao = signal<string | null>(null);
    erroMsg = signal<string | null>(null);

    readonly LIMITE_MUSICAS = 25;
    readonly podeAdicionarMusica = computed(() => this.totalMusicasCustom() < this.LIMITE_MUSICAS);

    ngOnInit() {
        const uid = this.auth.user()?.uid;
        if (!uid) return;

        this.listaService.getMinhasListas(uid).subscribe({
            next: listas => {
                this.minhasListas.set(listas);
                this.carregando.set(false);
            },
            error: (err: Error) => {
                this.carregando.set(false);
                this.mostrarErro(err.message || 'Erro ao carregar listas.');
            },
        });

        this.cifraService.countCifrasDoUser(uid).subscribe(count => {
            this.totalMusicasCustom.set(count);
        });
    }

    sair() {
        this.auth.logout().subscribe(() => this.router.navigate(['/admin']));
    }

    iniciarCriacaoLista() {
        this.novaListaTitulo.set('');
        this.novaListaCategoria.set('tempo-comum');
        this.criandoLista.set(true);
    }

    cancelarCriacaoLista() {
        this.criandoLista.set(false);
    }

    criarLista() {
        const titulo = this.novaListaTitulo().trim();
        if (!titulo) return;

        const uid = this.auth.user()?.uid!;
        const token = newId('tok');
        const lista: Lista = {
            id: '',
            titulo,
            categoria: this.novaListaCategoria(),
            musicas: [],
            tipo: 'privada' as TipoLista,
            donoUid: uid,
            donoNome: this.auth.displayName() || undefined,
            participantes: [],
            tokenConvite: token,
            criadaEm: new Date().toISOString(),
            atualizadaEm: new Date().toISOString(),
        };

        this.salvandoLista.set(true);
        this.listaService.salvarLista(lista).subscribe({
            next: salva => {
                this.salvandoLista.set(false);
                this.criandoLista.set(false);
                this.minhasListas.update(ls => [...ls, salva]);
                this.router.navigate(['/minha-area/lista', salva.id]);
            },
            error: (err: Error) => {
                this.salvandoLista.set(false);
                this.mostrarErro(err.message || 'Erro ao criar lista.');
            },
        });
    }

    confirmarExcluir(id: string) { this.confirmandoExclusao.set(id); }
    cancelarExcluir() { this.confirmandoExclusao.set(null); }

    excluirLista(id: string) {
        this.listaService.excluirLista(id).subscribe({
            next: () => {
                this.confirmandoExclusao.set(null);
                this.minhasListas.update(ls => ls.filter(l => l.id !== id));
            },
            error: (err: Error) => {
                this.confirmandoExclusao.set(null);
                this.mostrarErro(err.message || 'Erro ao excluir lista.');
            },
        });
    }

    abrirLista(id: string) {
        this.router.navigate(['/minha-area/lista', id]);
    }

    mostrarNotificacao(msg: string) {
        this.notificacao.set(msg);
        setTimeout(() => this.notificacao.set(null), 3000);
    }

    mostrarErro(msg: string) {
        this.erroMsg.set(msg);
        setTimeout(() => this.erroMsg.set(null), 5000);
    }

    trackById(_: number, item: { id: string }) { return item.id; }
}
