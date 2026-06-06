import { Component, input, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Secao, LinhaCifra, TipoSecao } from '../../models/cifra.model';
import { LinhaEditorComponent } from '../linha-editor/linha-editor';
import { AppSelectComponent } from '../app-select/app-select';
import { parseCifraTexto, cifraToTexto } from '../../core/cifra-parser';

const TIPOS: TipoSecao[] = ['intro', 'verso', 'pre-refrao', 'refrao', 'ponte', 'outro', 'solo', 'tab'];

@Component({
    selector: 'app-secoes-cifra-editor',
    standalone: true,
    imports: [CommonModule, DragDropModule, LinhaEditorComponent, AppSelectComponent],
    templateUrl: './secoes-cifra-editor.html',
    styleUrl: './secoes-cifra-editor.scss',
})
export class SecoesCifraEditorComponent {
    readonly secoesIniciais = input<Secao[]>([]);

    readonly tiposSecaoOptions = TIPOS;

    private secoesInternas = signal<Secao[]>([]);
    modoTexto   = signal(false);
    textoEditor = signal('');
    selecionadas = signal<Set<string>>(new Set());
    clipboard    = signal<LinhaCifra[] | null>(null);

    readonly temSelecao = computed(() => this.selecionadas().size > 0);

    private initialized = false;

    constructor() {
        effect(() => {
            const s = this.secoesIniciais();
            if (!this.initialized && s.length > 0) {
                this.initialized = true;
                this.secoesInternas.set(JSON.parse(JSON.stringify(s)));
            }
        }, { allowSignalWrites: true });
    }

    get secoes(): Secao[] { return this.secoesInternas(); }

    getSecoesAtuais(): Secao[] {
        if (this.modoTexto()) {
            const texto = this.textoEditor();
            return texto.trim() ? parseCifraTexto(texto) : this.secoesInternas();
        }
        return this.secoesInternas();
    }

    reset(secoes: Secao[]) {
        this.initialized = true;
        this.secoesInternas.set(JSON.parse(JSON.stringify(secoes)));
        this.modoTexto.set(false);
        this.textoEditor.set('');
        this.selecionadas.set(new Set());
        this.clipboard.set(null);
    }

    // ─── Seções ──────────────────────────────────────────────────────

    addSecao() {
        const nova: Secao = { tipo: 'verso', label: 'Nova Seção', linhas: [{ letra: '', acordes: [] }] };
        this.secoesInternas.update(ss => [...ss, nova]);
    }

    removeSecao(idx: number) {
        this.secoesInternas.update(ss => ss.filter((_, i) => i !== idx));
    }

    updateSecaoLabel(idx: number, label: string) {
        this.secoesInternas.update(ss => {
            const next = [...ss];
            next[idx] = { ...next[idx], label };
            return next;
        });
    }

    onSecaoTipoChange(idx: number, value: string) {
        this.updateSecaoTipo(idx, value as TipoSecao);
    }

    updateSecaoTipo(idx: number, tipo: TipoSecao) {
        this.secoesInternas.update(ss => {
            const next = [...ss];
            const secao = next[idx];
            if (tipo === 'tab') {
                next[idx] = { ...secao, tipo, linhas: [], tabText: secao.linhas.map(l => l.letra).join('\n') };
            } else if (secao.tipo === 'tab') {
                next[idx] = { ...secao, tipo, linhas: (secao.tabText ?? '').split('\n').map(l => ({ letra: l, acordes: [] })), tabText: undefined };
            } else {
                next[idx] = { ...secao, tipo };
            }
            return next;
        });
    }

    updateTabText(idx: number, tabText: string) {
        this.secoesInternas.update(ss => {
            const next = [...ss];
            next[idx] = { ...next[idx], tabText };
            return next;
        });
    }

    // ─── Linhas ──────────────────────────────────────────────────────

    addLinha(secaoIdx: number) {
        this.secoesInternas.update(ss => {
            const next = [...ss];
            next[secaoIdx] = { ...next[secaoIdx], linhas: [...next[secaoIdx].linhas, { letra: '', acordes: [] }] };
            return next;
        });
    }

    removeLinha(secaoIdx: number, linhaIdx: number) {
        this.secoesInternas.update(ss => {
            const next = [...ss];
            next[secaoIdx] = { ...next[secaoIdx], linhas: next[secaoIdx].linhas.filter((_, i) => i !== linhaIdx) };
            return next;
        });
    }

    updateLinha(secaoIdx: number, linhaIdx: number, linha: LinhaCifra) {
        this.secoesInternas.update(ss => {
            const next = [...ss];
            const linhas = [...next[secaoIdx].linhas];
            linhas[linhaIdx] = linha;
            next[secaoIdx] = { ...next[secaoIdx], linhas };
            return next;
        });
    }

    // ─── Modo texto / visual ─────────────────────────────────────────

    entrarModoTexto() {
        this.textoEditor.set(cifraToTexto(this.secoesInternas()));
        this.modoTexto.set(true);
    }

    entrarModoVisual() {
        const texto = this.textoEditor();
        if (texto.trim()) {
            this.secoesInternas.set(parseCifraTexto(texto));
        }
        this.modoTexto.set(false);
    }

    // ─── Seleção / Copiar / Colar ────────────────────────────────────

    linhaKey(si: number, li: number) { return `${si}-${li}`; }

    isSelected(si: number, li: number) { return this.selecionadas().has(this.linhaKey(si, li)); }

    toggleSelecao(si: number, li: number) {
        this.selecionadas.update(s => {
            const n = new Set(s);
            const k = this.linhaKey(si, li);
            if (n.has(k)) { n.delete(k); } else { n.add(k); }
            return n;
        });
    }

    limparSelecao() { this.selecionadas.set(new Set()); }

    private _linhasSelecionadas(): LinhaCifra[] {
        const keys = this.selecionadas();
        const out: LinhaCifra[] = [];
        this.secoesInternas().forEach((s, si) => s.linhas.forEach((l, li) => {
            if (keys.has(this.linhaKey(si, li))) out.push(JSON.parse(JSON.stringify(l)));
        }));
        return out;
    }

    copiarSelecionadas() {
        this.clipboard.set(this._linhasSelecionadas());
        this.selecionadas.set(new Set());
    }

    recortarSelecionadas() {
        this.clipboard.set(this._linhasSelecionadas());
        const keys = this.selecionadas();
        this.secoesInternas.update(ss => ss.map((s, si) => ({
            ...s, linhas: s.linhas.filter((_, li) => !keys.has(this.linhaKey(si, li))),
        })));
        this.selecionadas.set(new Set());
    }

    colarEm(si: number, li: number) {
        const linhas = this.clipboard();
        if (!linhas?.length) return;
        this.secoesInternas.update(ss => {
            const next = [...ss];
            const novas = [...next[si].linhas];
            novas.splice(li, 0, ...linhas.map(l => JSON.parse(JSON.stringify(l))));
            next[si] = { ...next[si], linhas: novas };
            return next;
        });
    }

    // ─── Drag & Drop ─────────────────────────────────────────────────

    onLinhasDrop(event: CdkDragDrop<number>) {
        if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;
        const fromSi = event.previousContainer.data;
        const toSi   = event.container.data;
        this.secoesInternas.update(ss => {
            const next = ss.map(s => ({ ...s, linhas: [...s.linhas] }));
            const [linha] = next[fromSi].linhas.splice(event.previousIndex, 1);
            next[toSi].linhas.splice(event.currentIndex, 0, linha);
            return next;
        });
        this.selecionadas.set(new Set());
    }
}
