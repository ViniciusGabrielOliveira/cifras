import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ListaService } from '../../../services/lista.service';
import { AuthService } from '../../../services/auth.service';
import { Participante } from '../../../models/lista.model';

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

    estado = signal<'carregando' | 'entrando' | 'sucesso' | 'ja-membro' | 'erro'>('carregando');
    nomeLista = signal('');
    erro = signal('');

    ngOnInit() {
        const token = this.route.snapshot.paramMap.get('listaId') ?? '';
        if (!token) {
            this.estado.set('erro');
            this.erro.set('Link inválido.');
            return;
        }

        this.listaService.getListaPorToken(token).subscribe({
            next: lista => {
                if (!lista) {
                    this.estado.set('erro');
                    this.erro.set('Convite não encontrado ou expirado.');
                    return;
                }

                this.nomeLista.set(lista.titulo);

                const uid = this.auth.user()?.uid!;
                const jaMembro = lista.participantes?.some(p => p.uid === uid)
                    || lista.donoUid === uid;

                if (jaMembro) {
                    this.estado.set('ja-membro');
                    setTimeout(() => this.router.navigate(['/minha-area/lista', lista.id]), 1500);
                    return;
                }

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
                        this.estado.set('erro');
                        this.erro.set('Não foi possível entrar na lista. Tente novamente.');
                    },
                });
            },
            error: () => {
                this.estado.set('erro');
                this.erro.set('Não foi possível processar o convite. Tente novamente.');
            },
        });
    }
}
