import { Component, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
    private auth = inject(AuthService);

    email = signal('admin@cifras.missa');
    senha = signal('');
    erro = signal('');
    carregando = signal(false);

    constructor() {
        effect(() => {
            if (!this.auth.loading() && this.auth.isLogado()) {
                this.router.navigate(['/admin/painel']);
            }
        });
    }

    entrar() {
        this.erro.set('');
        this.carregando.set(true);
        this.auth.login(this.email(), this.senha()).subscribe({
            next: () => {
                this.carregando.set(false);
                this.router.navigate(['/admin/painel']);
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
                    this.router.navigate(['/admin/completar-cadastro']);
                } else {
                    this.router.navigate(['/admin/painel']);
                }
            },
            error: (err) => {
                this.carregando.set(false);
                this.erro.set(err.message || 'Erro no login social.');
            },
        });
    }
}
