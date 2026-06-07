import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-completar-cadastro',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './completar-cadastro.html',
    styleUrl: '../login/login.scss',
})
export class CompletarCadastroComponent implements OnInit {
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private auth = inject(AuthService);

    telefone = signal('');
    erro = signal('');
    carregando = signal(false);

    private get returnUrl(): string {
        return this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
    }

    private rotaPosLogin(): string {
        return this.returnUrl || '/';
    }

    ngOnInit() {
        const user = this.auth.user();
        if (!user) {
            this.router.navigate(['/admin']);
        } else if (user.telefone) {
            this.router.navigate([this.rotaPosLogin()]);
        }
    }

    salvar() {
        this.erro.set('');
        const tel = this.telefone().replace(/\D/g, '');
        if (tel && tel.length < 10) {
            this.erro.set('Por favor, insira um telefone válido com DDD.');
            return;
        }

        this.carregando.set(true);
        this.auth.atualizarPerfil({ telefone: tel || undefined }).subscribe({
            next: () => {
                this.carregando.set(false);
                this.router.navigate([this.rotaPosLogin()]);
            },
            error: (err) => {
                this.carregando.set(false);
                this.erro.set(err.message || 'Erro ao atualizar perfil.');
            },
        });
    }

    formatarTelefone(event: Event) {
        let val = (event.target as HTMLInputElement).value.replace(/\D/g, '');
        if (val.length > 11) val = val.substring(0, 11);

        if (val.length > 7) {
            val = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
        } else if (val.length > 2) {
            val = `(${val.substring(0, 2)}) ${val.substring(2)}`;
        }
        this.telefone.set(val);
    }
}
