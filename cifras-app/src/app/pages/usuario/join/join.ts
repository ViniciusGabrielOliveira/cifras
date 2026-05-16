import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Lista, Participante } from '../../../models/lista.model';
import { ListaService } from '../../../services/lista.service';
import { AuthService } from '../../../services/auth.service';

type Estado = 'carregando' | 'convite' | 'entrando' | 'sucesso' | 'ja-membro' | 'erro';

@Component({
    selector: 'app-join',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './join.html',
    styleUrl: './join.scss',
})
export class JoinComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private listaService = inject(ListaService);
    readonly auth = inject(AuthService);

    estado = signal<Estado>('carregando');
    lista = signal<Lista | null>(null);
    erro = signal('');

    readonly nomeLista = computed(() => this.lista()?.titulo ?? '');
    readonly nomeConvidador = computed(() => this.lista()?.donoNome ?? '');
    readonly token = signal('');

    readonly returnUrl = computed(() => `/join/${this.token()}`);

    ngOnInit() {
        const token = this.route.snapshot.paramMap.get('listaId') ?? '';
        if (!token) {
            this.erro.set('Link inválido.');
            this.estado.set('erro');
            return;
        }
        this.token.set(token);

        this.listaService.getListaPorToken(token).subscribe({
            next: lista => {
                if (!lista) {
                    this.erro.set('Convite não encontrado ou expirado.');
                    this.estado.set('erro');
                    return;
                }
                this.lista.set(lista);

                const uid = this.auth.user()?.uid;
                if (uid) {
                    const jaMembro = lista.participantes?.some(p => p.uid === uid)
                        || lista.donoUid === uid;
                    if (jaMembro) {
                        this.estado.set('ja-membro');
                        setTimeout(() => this.router.navigate(['/minha-area/lista', lista.id]), 1500);
                        return;
                    }
                }

                this.estado.set('convite');
            },
            error: () => {
                this.erro.set('Não foi possível processar o convite. Tente novamente.');
                this.estado.set('erro');
            },
        });
    }

    continuar() {
        const lista = this.lista();
        const uid = this.auth.user()?.uid;
        if (!lista || !uid) return;

        this.estado.set('entrando');
        const participante: Participante = {
            uid,
            nome: this.auth.displayName() || uid,
            role: 'visualizador',
        };

        this.listaService.adicionarParticipante(lista.id, participante).subscribe({
            next: () => {
                this.estado.set('sucesso');
                setTimeout(() => this.router.navigate(['/minha-area/lista', lista.id]), 1800);
            },
            error: () => {
                this.erro.set('Não foi possível entrar na lista. Tente novamente.');
                this.estado.set('erro');
            },
        });
    }

    irParaLogin() {
        this.router.navigate(['/admin'], { queryParams: { returnUrl: this.returnUrl() } });
    }

    irParaCadastro() {
        this.router.navigate(['/admin/cadastro'], { queryParams: { returnUrl: this.returnUrl() } });
    }
}
