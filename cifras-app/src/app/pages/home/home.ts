import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Lista, MusicaLista } from '../../models/lista.model';
import { ListaService } from '../../services/lista.service';
import { CifraService } from '../../services/cifra.service';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';
import { Cifra } from '../../models/cifra.model';
import { SecaoCifraComponent } from '../../components/secao-cifra/secao-cifra';
import { transporCifra } from '../../core/transposicao';

type SeletorAba = 'dia' | 'categoria';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, SecaoCifraComponent],
    templateUrl: './home.html',
    styleUrl: './home.scss',
})
export class HomeComponent implements OnInit {
    private listaService = inject(ListaService);
    private cifraService = inject(CifraService);
    readonly config = inject(ConfigService);
    readonly auth = inject(AuthService);

    @ViewChild('inputData') inputData!: ElementRef<HTMLInputElement>;

    // ── Seletor de lista ─────────────────────────────────────────────
    seletorAberta = signal(false);
    abaAtiva = signal<SeletorAba>('dia');
    dataSelecionada = signal(new Date().toISOString().split('T')[0]);
    catSelecionada = signal('tempo-comum');
    listasDoFiltro = signal<Lista[]>([]);

    // ── Lista atual ──────────────────────────────────────────────────
    listaAtual = signal<Lista | null>(null);
    loading = signal(true);

    // ── Tabs partes da missa ─────────────────────────────────────────
    partesDisponiveis = computed<string[]>(() => {
        const l = this.listaAtual();
        if (!l) return [];
        const usadas = new Set(l.musicas.map(m => m.parte));
        return this.config.partesIds().filter(p => usadas.has(p));
    });
    parteAtiva = signal<string | null>(null);

    musicasDaParte = computed<MusicaLista[]>(() => {
        const l = this.listaAtual();
        const p = this.parteAtiva();
        if (!l || !p) return [];
        return l.musicas
            .filter(m => m.parte === p)
            .sort((a, b) => a.ordem - b.ordem);
    });

    // ── Accordion / Cifra ────────────────────────────────────────────
    acordeonAberto = signal<string | null>(null);
    cifrasCache = signal<Record<string, Cifra | null>>({});
    cifraExpandida = computed<Cifra | null>(() => {
        const id = this.acordeonAberto();
        const map = this.cifrasCache();
        return id ? (map[id] ?? null) : null;
    });
    deltasTom = signal<Record<string, number>>({});
    fontesSize = signal<Record<string, number>>({});

    cifraTransposta = computed<Cifra | null>(() => {
        const c = this.cifraExpandida();
        if (!c) return null;
        const delta = this.deltasTom()[c.id] ?? 0;
        return transporCifra(c, delta);
    });

    // ── Labels (template) ────────────────────────────────────────────
    get CATEGORIAS_LABELS() { return this.config.categoriasLabels(); }
    get PARTES_MISSA_LABELS() { return this.config.partesLabels(); }
    get categories() { return this.config.categoriasIds().filter(id => id !== 'sem-categoria'); }

    ngOnInit(): void {
        // Carrega listas do dia de hoje
        this.carregarListasPorData(this.dataSelecionada());
    }

    abrirCalendario() {
        this.mudarAba('dia');

        const input = this.inputData.nativeElement;

        if (input.showPicker) {
            input.showPicker();
        } else {
            input.click();
        }
    }

    // ─── Seletor ──────────────────────────────────────────────────────

    abrirSeletor() { this.seletorAberta.set(true); }
    fecharSeletor() { this.seletorAberta.set(false); }

    mudarAba(aba: SeletorAba) {
        this.abaAtiva.set(aba);
        if (aba === 'dia') {
            this.carregarListasPorData(this.dataSelecionada());
        } else {
            this.carregarListasPorCategoria(this.catSelecionada());
        }
    }

    onDataChange(data: string) {
        this.dataSelecionada.set(data);
        this.carregarListasPorData(data);
    }

    onDataInputChange(event: Event) {
        const val = (event.target as HTMLInputElement).value;
        this.dataSelecionada.set(val);
        this.carregarListasPorData(val);
    }

    onCatChange(cat: string) {
        this.catSelecionada.set(cat);
        this.carregarListasPorCategoria(cat);
    }

    private carregarListasPorData(data: string) {
        this.loading.set(true);
        this.listaService.getListasDodia(data).subscribe(listas => {
            this.listasDoFiltro.set(listas);
            if (!this.listaAtual() && listas.length > 0) {
                this.selecionarLista(listas[0]);
            }
            this.loading.set(false);
        });
    }

    private carregarListasPorCategoria(cat: string) {
        this.listaService.getListasPorCategoria(cat).subscribe(listas => {
            this.listasDoFiltro.set(listas);
        });
    }

    selecionarLista(lista: Lista) {
        this.listaAtual.set(lista);
        this.acordeonAberto.set(null);
        const partes = this.config.partesIds().filter(p => lista.musicas.some(m => m.parte === p));
        this.parteAtiva.set(partes[0] ?? null);
        this.fecharSeletor();
    }

    // ─── Tabs ─────────────────────────────────────────────────────────

    selecionarParte(parte: string) {
        this.parteAtiva.set(parte);
        this.acordeonAberto.set(null);
    }

    // ─── Accordion ──────────────────────────────────────────────────

    toggleMusica(musica: MusicaLista, el: HTMLElement) {
        const jaAberta = this.acordeonAberto() === musica.id;
        this.acordeonAberto.set(jaAberta ? null : musica.id);

        if (!jaAberta) {
            this.carregarCifra(musica.cifraId);
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        }
    }

    toggleMusicaFromBtn(musica: MusicaLista, btn: HTMLButtonElement) {
        const cardEl = btn.closest('.musica-card') as HTMLElement | null;
        this.toggleMusica(musica, cardEl ?? btn);
    }

    private carregarCifra(cifraId: string) {
        const cache = this.cifrasCache();
        if (cifraId in cache) return;

        // Marca como carregando
        this.cifrasCache.update(c => ({ ...c, [cifraId]: null }));

        this.cifraService.getCifra(cifraId).subscribe(cifra => {
            this.cifrasCache.update(c => ({ ...c, [cifraId]: cifra ?? null }));
        });
    }

    isCarregandoCifra(cifraId: string): boolean {
        const cache = this.cifrasCache();
        return cifraId in cache && cache[cifraId] === null;
    }

    getCifraDoCache(cifraId: string): Cifra | null {
        return this.cifrasCache()[cifraId] ?? null;
    }

    getCifraTransposta(cifra: Cifra): Cifra {
        const delta = this.deltasTom()[cifra.id] ?? 0;
        return transporCifra(cifra, delta);
    }

    mudarTom(cifraId: string, delta: number) {
        this.deltasTom.update(m => ({ ...m, [cifraId]: (m[cifraId] ?? 0) + delta }));
    }

    getDelta(cifraId: string): number {
        return this.deltasTom()[cifraId] ?? 0;
    }

    restaurarTom(cifraId: string) {
        this.deltasTom.update(m => ({ ...m, [cifraId]: 0 }));
    }

    getFonteSize(cifraId: string): number {
        return this.fontesSize()[cifraId] ?? 15;
    }

    mudarFonte(cifraId: string, delta: number) {
        this.fontesSize.update(m => {
            const atual = m[cifraId] ?? 15;
            return { ...m, [cifraId]: Math.min(24, Math.max(12, atual + delta)) };
        });
    }

    // ─── Helpers de data ─────────────────────────────────────────────

    formatarData(iso?: string): string {
        if (!iso) return '';
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        });
    }

    dataHoje(): string {
        return new Date().toISOString().split('T')[0];
    }

}
