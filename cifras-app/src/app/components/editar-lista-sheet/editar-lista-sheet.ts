import { Component, inject, signal, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Lista, RoleParticipante, TipoLista } from '../../models/lista.model';
import { ListaService } from '../../services/lista.service';
import { AuthService } from '../../services/auth.service';
import { ConfigService } from '../../services/config.service';
import { AppSelectComponent, SelectOption } from '../app-select/app-select';

@Component({
    selector: 'app-editar-lista-sheet',
    standalone: true,
    imports: [CommonModule, FormsModule, AppSelectComponent],
    templateUrl: './editar-lista-sheet.html',
    styleUrl: './editar-lista-sheet.scss',
})
export class EditarListaSheetComponent {
    private listaService = inject(ListaService);
    readonly auth = inject(AuthService);
    private config = inject(ConfigService);

    readonly lista = input<Lista | null>(null);
    readonly listaSalva = output<Lista>();

    readonly aberto   = signal(false);
    readonly salvando = signal(false);
    readonly linkCopiado = signal(false);
    readonly confirmandoRemover = signal<string | null>(null);

    readonly categoriasOptions = computed<SelectOption[]>(() =>
        this.config.categoriasIds().map(id => ({ value: id, label: this.config.categoriasLabels()[id] ?? id }))
    );
    readonly roleOptions: SelectOption[] = [
        { value: 'visualizador', label: 'Visualizador' },
        { value: 'editor',       label: 'Editor' },
    ];

    readonly isDono = computed(() => {
        const uid = this.auth.user()?.uid;
        return !!uid && uid === this.lista()?.donoUid;
    });

    get linkConvite(): string {
        const token = this.lista()?.tokenConvite;
        if (!token) return '';
        return `${document.baseURI.replace(/\/$/, '')}/join/${token}`;
    }

    abrir() { this.aberto.set(true); }
    fechar() {
        this.aberto.set(false);
        this.confirmandoRemover.set(null);
    }

    // ── Campos ────────────────────────────────────────────────────────

    onTituloBlur(event: Event) {
        const val = (event.target as HTMLInputElement).value.trim();
        if (!val || val === this.lista()?.titulo) return;
        this.salvar({ titulo: val });
    }

    onDataInicioChange(event: Event) {
        const val = (event.target as HTMLInputElement).value || undefined;
        this.salvar({ dataInicio: val });
    }

    onDataFimChange(event: Event) {
        const val = (event.target as HTMLInputElement).value || undefined;
        this.salvar({ dataFim: val });
    }

    onCategoriaChange(categoria: string) {
        this.salvar({ categoria });
    }

    onTipoChange(tipo: TipoLista) {
        this.salvar({ tipo });
    }

    // ── Participantes ─────────────────────────────────────────────────

    copiarLink() {
        navigator.clipboard.writeText(this.linkConvite).then(() => {
            this.linkCopiado.set(true);
            setTimeout(() => this.linkCopiado.set(false), 2000);
        });
    }

    onRoleChange(uid: string, role: string) {
        const listaId = this.lista()?.id;
        if (!listaId) return;
        this.listaService.atualizarRoleParticipante(listaId, uid, role as RoleParticipante).subscribe({
            next: () => {
                const atual = this.lista();
                if (!atual) return;
                const atualizada = {
                    ...atual,
                    participantes: (atual.participantes ?? []).map(p =>
                        p.uid === uid ? { ...p, role: role as RoleParticipante } : p
                    ),
                };
                this.listaSalva.emit(atualizada);
            },
        });
    }

    toggleControlador(uid: string) {
        const lista = this.lista();
        if (!lista || !this.isDono()) return;
        const atuais = lista.controladoresUids ?? [];
        const novos = atuais.includes(uid) ? atuais.filter(u => u !== uid) : [...atuais, uid];
        this.listaService.atualizarControladoresUids(lista.id, novos).subscribe({
            next: () => this.listaSalva.emit({ ...lista, controladoresUids: novos }),
        });
    }

    confirmarRemover(uid: string) { this.confirmandoRemover.set(uid); }
    cancelarRemover() { this.confirmandoRemover.set(null); }

    removerParticipante(uid: string) {
        const lista = this.lista();
        if (!lista) return;
        this.listaService.removerParticipante(lista.id, uid).subscribe({
            next: () => {
                const atualizada = {
                    ...lista,
                    participantes: (lista.participantes ?? []).filter(p => p.uid !== uid),
                };
                this.listaSalva.emit(atualizada);
                this.confirmandoRemover.set(null);
            },
        });
    }

    // ── Salvar ────────────────────────────────────────────────────────

    private salvar(patch: Partial<Lista>) {
        const atual = this.lista();
        if (!atual) return;
        const atualizada: Lista = { ...atual, ...patch, atualizadaEm: new Date().toISOString() };
        this.salvando.set(true);
        this.listaService.salvarLista(atualizada).subscribe({
            next: (salva) => {
                this.salvando.set(false);
                this.listaSalva.emit(salva);
            },
            error: () => this.salvando.set(false),
        });
    }
}
