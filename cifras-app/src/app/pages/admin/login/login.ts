import { Component, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './login.html',
    styleUrl: './login.scss',
})
export class LoginComponent {
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private auth = inject(AuthService);

    email = signal('admin@cifras.missa');
    senha = signal('');
    erro = signal('');
    carregando = signal(false);

    private get returnUrl(): string {
        return this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
    }

    constructor() {
        effect(() => {
            if (!this.auth.loading() && this.auth.isLogado()) {
                this.router.navigateByUrl(this.returnUrl || this.rotaPosLogin());
            }
        });
    }

    private rotaPosLogin(): string {
        return this.auth.hasRole('editor') ? '/admin/painel' : '/minha-area';
    }

    entrar() {
        this.erro.set('');
        this.carregando.set(true);
        this.auth.login(this.email(), this.senha()).subscribe({
            next: () => {
                this.carregando.set(false);
                this.router.navigateByUrl(this.returnUrl || this.rotaPosLogin());
            },
            error: (err) => {
                this.carregando.set(false);
                this.erro.set(err.message || 'Email ou senha incorretos.');
            },
        });
    }

    loginGoogle() {
        this.erro.set('');
        this.carregando.set(true);
        this.auth.loginSocial('google').subscribe({
            next: (user) => {
                this.carregando.set(false);
                if (!user.telefone) {
                    this.router.navigate(['/admin/completar-cadastro'], {
                        queryParams: this.returnUrl ? { returnUrl: this.returnUrl } : {},
                    });
                } else {
                    this.router.navigateByUrl(this.returnUrl || this.rotaPosLogin());
                }
            },
            error: (err) => {
                this.carregando.set(false);
                this.erro.set(err.message || 'Erro no login social.');
            },
        });
    }
}
