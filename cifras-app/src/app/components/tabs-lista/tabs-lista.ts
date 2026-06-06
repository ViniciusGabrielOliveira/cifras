import { Component, inject, input, output, signal, computed, HostListener, ViewChild, ElementRef, afterNextRender, Injector } from '@angular/core';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Lista, ParteLista } from '../../models/lista.model';
import { ConfigService } from '../../services/config.service';

@Component({
    selector: 'app-tabs-lista',
    standalone: true,
    imports: [DragDropModule],
    templateUrl: './tabs-lista.html',
    styleUrl: './tabs-lista.scss',
})
export class TabsListaComponent {
    private config = inject(ConfigService);
    private injector = inject(Injector);

    readonly lista    = input.required<Lista | null>();
    readonly parteAtiva = input<string | null>(null);
    readonly canEdit  = input(false);

    readonly parteChange  = output<string>();
    readonly listaChange  = output<Lista>();

    readonly partesDisponiveis = computed<string[]>(() => {
        const l = this.lista();
        if (!l) return [];
        if (l.partes) return l.partes.map(p => p.id);
        const usadas = new Set(l.musicas.map(m => m.parte));
        return this.config.partesIds().filter(p => usadas.has(p));
    });

    readonly partesParaAdicionar = computed<{ id: string; label: string }[]>(() => {
        const lista = this.lista();
        if (!lista) return [];
        const emUso = new Set(lista.partes?.map(p => p.id) ?? lista.musicas.map(m => m.parte));
        return this.config.partesIds()
            .filter(id => !emUso.has(id))
            .map(id => ({ id, label: this.config.partesLabels()[id] ?? id }));
    });

    readonly opcoesFiltradas = computed(() => {
        const busca = this.buscaParte().toLowerCase().trim();
        if (!busca) return this.partesParaAdicionar();
        return this.partesParaAdicionar().filter(p => p.label.toLowerCase().includes(busca));
    });

    readonly mostrarCriarParte = computed(() => {
        const busca = this.buscaParte().trim();
        if (!busca) return false;
        return !this.partesParaAdicionar().some(p => p.label.toLowerCase() === busca.toLowerCase());
    });

    @ViewChild('autocompleteInput') autocompleteInputRef?: ElementRef<HTMLInputElement>;
    @ViewChild('tabEditInput') tabEditInputRef?: ElementRef<HTMLInputElement>;

    adicionandoParte   = signal(false);
    buscaParte         = signal('');
    tabMenuAberto      = signal<string | null>(null);
    tabMenuPos         = signal<{ top: number; right: number } | null>(null);
    editandoTab        = signal<string | null>(null);
    editandoTabLabel   = signal('');

    parteLabel(parteId: string): string {
        const parteLista = this.lista()?.partes?.find(p => p.id === parteId);
        return parteLista?.label ?? this.config.partesLabels()[parteId] ?? parteId;
    }

    parteVazia(parteId: string): boolean {
        return !(this.lista()?.musicas.some(m => m.parte === parteId) ?? false);
    }

    selecionarParte(parte: string) {
        this.parteChange.emit(parte);
    }

    // ── Adicionar parte ───────────────────────────────────────────────

    toggleAdicionarParte() {
        const novo = !this.adicionandoParte();
        this.adicionandoParte.set(novo);
        this.buscaParte.set('');
        if (novo) afterNextRender(() => this.autocompleteInputRef?.nativeElement.focus(), { injector: this.injector });
    }

    addParte(parteId: string) {
        const lista = this.lista();
        if (!lista) return;
        const partesAtuais: ParteLista[] = lista.partes
            ?? [...new Set(lista.musicas.map(m => m.parte))].map(id => ({ id }));
        if (partesAtuais.some(p => p.id === parteId)) return;
        const atualizada = { ...lista, partes: [...partesAtuais, { id: parteId }] };
        this.listaChange.emit(atualizada);
        this.parteChange.emit(parteId);
        this.adicionandoParte.set(false);
        this.buscaParte.set('');
    }

    addPartePersonalizada(label: string) {
        const lista = this.lista();
        if (!lista || !label.trim()) return;
        const id = `parte-${Date.now()}`;
        const partesAtuais: ParteLista[] = lista.partes
            ?? [...new Set(lista.musicas.map(m => m.parte))].map(id => ({ id }));
        const atualizada = { ...lista, partes: [...partesAtuais, { id, label: label.trim() }] };
        this.listaChange.emit(atualizada);
        this.parteChange.emit(id);
        this.adicionandoParte.set(false);
        this.buscaParte.set('');
    }

    onParteBuscaEnter() {
        const opcoes = this.opcoesFiltradas();
        if (opcoes.length > 0) {
            this.addParte(opcoes[0].id);
        } else {
            const busca = this.buscaParte().trim();
            if (busca) this.addPartePersonalizada(busca);
        }
    }

    removeParte(parteId: string) {
        this.tabMenuAberto.set(null); this.tabMenuPos.set(null);
        const lista = this.lista();
        if (!lista?.partes || lista.musicas.some(m => m.parte === parteId)) return;
        const atualizada = { ...lista, partes: lista.partes.filter(p => p.id !== parteId) };
        this.listaChange.emit(atualizada);
    }

    // ── Tab menu / edição ──────────────────────────────────────────────

    @HostListener('document:click')
    fecharTabMenu() { this.tabMenuAberto.set(null); this.tabMenuPos.set(null); }

    toggleTabMenu(parteId: string, btn: HTMLElement) {
        if (this.tabMenuAberto() === parteId) {
            this.tabMenuAberto.set(null); this.tabMenuPos.set(null);
        } else {
            const rect = btn.getBoundingClientRect();
            this.tabMenuAberto.set(parteId);
            this.tabMenuPos.set({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
        }
    }

    iniciarEditarTab(parteId: string) {
        this.tabMenuAberto.set(null); this.tabMenuPos.set(null);
        this.editandoTabLabel.set(this.parteLabel(parteId));
        this.editandoTab.set(parteId);
        afterNextRender(() => this.tabEditInputRef?.nativeElement.focus(), { injector: this.injector });
    }

    confirmarEditarTab() {
        const parteId = this.editandoTab();
        const novoLabel = this.editandoTabLabel().trim();
        this.editandoTab.set(null);
        if (!parteId || !novoLabel) return;
        const lista = this.lista();
        if (!lista) return;
        const partesAtuais: ParteLista[] = lista.partes ?? this.partesDisponiveis().map(id => ({ id }));
        const atualizada: Lista = {
            ...lista,
            partes: partesAtuais.map(p => p.id === parteId ? { ...p, label: novoLabel } : p),
        };
        this.listaChange.emit(atualizada);
    }

    cancelarEditarTab() { this.editandoTab.set(null); this.editandoTabLabel.set(''); }

    // ── Drag de tabs ───────────────────────────────────────────────────

    onTabDropped(event: CdkDragDrop<string[]>) {
        if (event.previousIndex === event.currentIndex) return;
        const lista = this.lista();
        if (!lista) return;
        const partesAtuais: ParteLista[] = lista.partes ?? this.partesDisponiveis().map(id => ({ id }));
        const partes = [...partesAtuais];
        moveItemInArray(partes, event.previousIndex, event.currentIndex);
        this.listaChange.emit({ ...lista, partes });
    }
}
