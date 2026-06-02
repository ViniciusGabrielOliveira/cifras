import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Cifra } from '../../../models/cifra.model';
import { CifraService } from '../../../services/cifra.service';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-cifras-privadas',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './cifras-privadas.html',
    styleUrl: './cifras-privadas.scss',
})
export class CifrasPrivadasComponent implements OnInit {
    private cifraService = inject(CifraService);
    private router       = inject(Router);
    readonly auth        = inject(AuthService);

    readonly cifras      = signal<Cifra[]>([]);
    readonly carregando  = signal(true);
    readonly busca       = signal('');
    readonly confirmando = signal<string | null>(null);
    readonly processando = signal<string | null>(null);
    readonly notificacao = signal<string | null>(null);
    readonly erroMsg     = signal<string | null>(null);

    readonly cifrasFiltradas = computed(() => {
        const q = this.busca().toLowerCase().trim();
        const lista = this.cifras();
        if (!q) return lista;
        return lista.filter(c =>
            c.titulo.toLowerCase().includes(q) ||
            c.artista.toLowerCase().includes(q) ||
            (c.donoUid ?? '').toLowerCase().includes(q)
        );
    });

    ngOnInit() {
        this.cifraService.getCifrasPrivadas().subscribe({
            next: cifras => {
                this.cifras.set(cifras.sort((a, b) => a.titulo.localeCompare(b.titulo)));
                this.carregando.set(false);
            },
            error: () => this.carregando.set(false),
        });
    }

    publicar(cifra: Cifra) {
        this.processando.set(cifra.id);
        this.cifraService.salvarCifra({ ...cifra, status: 'publica' }).subscribe({
            next: () => {
                this.cifras.update(l => l.filter(c => c.id !== cifra.id));
                this.processando.set(null);
                this.mostrarOk(`"${cifra.titulo}" publicada.`);
            },
            error: (err: Error) => {
                this.processando.set(null);
                this.mostrarErro(err.message || 'Erro ao publicar.');
            },
        });
    }

    editar(id: string) {
        this.router.navigate(['/admin/editar-cifra', id]);
    }

    confirmarDeletar(id: string) { this.confirmando.set(id); }
    cancelarDeletar()            { this.confirmando.set(null); }

    deletar(cifra: Cifra) {
        this.processando.set(cifra.id);
        this.confirmando.set(null);
        this.cifraService.deleteCifra(cifra.id).subscribe({
            next: () => {
                this.cifras.update(l => l.filter(c => c.id !== cifra.id));
                this.processando.set(null);
                this.mostrarOk(`"${cifra.titulo}" removida.`);
            },
            error: (err: Error) => {
                this.processando.set(null);
                this.mostrarErro(err.message || 'Erro ao remover.');
            },
        });
    }

    sair() { this.auth.logout().subscribe(() => this.router.navigate(['/admin'])); }

    uidCurto(uid?: string): string {
        return uid ? uid.slice(-8) : '—';
    }

    private mostrarOk(msg: string) {
        this.notificacao.set(msg);
        setTimeout(() => this.notificacao.set(null), 3000);
    }

    private mostrarErro(msg: string) {
        this.erroMsg.set(msg);
        setTimeout(() => this.erroMsg.set(null), 5000);
    }
}
