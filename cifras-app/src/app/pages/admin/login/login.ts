import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
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

    entrar() {
        this.erro.set('');
        this.carregando.set(true);
        setTimeout(() => {
            const ok = this.auth.login(this.email(), this.senha());
            this.carregando.set(false);
            if (ok) {
                this.router.navigate(['/admin/painel']);
            } else {
                this.erro.set('Email ou senha incorretos.');
            }
        }, 600);
    }
}
