import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-cadastro',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './cadastro.html',
    styleUrl: './cadastro.scss',
})
export class CadastroComponent {
    private router = inject(Router);
    private auth = inject(AuthService);

    nome = signal('');
    email = signal('');
    telefone = signal('');
    senha = signal('');
    confirmarSenha = signal('');
    erro = signal('');
    carregando = signal(false);

    cadastrar() {
        this.erro.set('');

        if (!this.nome().trim()) {
            this.erro.set('Informe seu nome.');
            return;
        }
        if (!this.email().trim()) {
            this.erro.set('Informe seu e-mail.');
            return;
        }
        if (this.senha().length < 6) {
            this.erro.set('A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (this.senha() !== this.confirmarSenha()) {
            this.erro.set('As senhas não coincidem.');
            return;
        }

        this.carregando.set(true);
        const tel = this.telefone().replace(/\D/g, '') || undefined;

        this.auth.registrar(this.email(), this.senha(), this.nome(), tel).subscribe({
            next: () => {
                this.carregando.set(false);
                this.router.navigate(['/admin/painel']);
            },
            error: (err) => {
                this.carregando.set(false);
                this.erro.set(err.message || 'Erro ao criar conta.');
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
