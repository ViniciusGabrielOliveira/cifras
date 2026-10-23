import { Component, inject, signal, input, output, OnInit, ElementRef, ViewChild } from '@angular/core';
import { forkJoin } from 'rxjs';
import { LiturgiaService } from '../../services/liturgia.service';
import { DiaLiturgico } from '../../models/liturgia.model';
import { dataLiturgicaHoje, escolherSugestao } from '../../core/liturgia';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Lista, TipoLista } from '../../models/lista.model';
import { ListaService } from '../../services/lista.service';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';

type SeletorAba = 'dia' | 'categoria' | 'minhas-listas';

@Component({
    selector: 'app-seletor-repertorio',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './seletor-repertorio.html',
    styleUrl: './seletor-repertorio.scss',
})
export class SeletorRepertorioComponent implements OnInit {
    private listaService = inject(ListaService);
    private liturgiaService = inject(LiturgiaService);
    private configService = inject(ConfigService);
    readonly auth = inject(AuthService);

    @ViewChild('inputData') inputData!: ElementRef<HTMLInputElement>;

    readonly listaAtual    = input<Lista | null>(null);
    readonly autoSelecionar = input(true);

    readonly listaSelecionada    = output<Lista>();
    readonly semResultadoInicial = output<void>();
    readonly diaConsultado = output<{ data: string; dia: DiaLiturgico; listas: Lista[] }>();
    readonly erroInicial = output<string>();
    readonly erroFiltro = signal('');
    readonly liturgiaDoFiltro = signal<DiaLiturgico | null>(null);
    private listasHoje: Lista[] = [];
    private pedido = 0;

    readonly aberto               = signal(false);
    readonly abaAtiva             = signal<SeletorAba>('dia');
    readonly dataSelecionada      = signal(dataLiturgicaHoje());
    readonly catSelecionada       = signal('tempo-comum');
    readonly listasDoFiltro       = signal<Lista[]>([]);
    readonly minhasListas         = signal<Lista[]>([]);
    readonly carregandoMinhasListas = signal(false);
    readonly carregandoFiltro     = signal(false);
    readonly criandoRepertorio    = signal(false);
    readonly novoTitulo           = signal('');
    readonly salvando             = signal(false);

    get CATEGORIAS_LABELS() { return this.configService.categoriasLabels(); }
    get categories() { return this.configService.categoriasIds().filter(id => id !== 'sem-categoria'); }

    ngOnInit() {
        this.carregarListasPorData(this.dataSelecionada(), true);
    }

    abrir() { this.aberto.set(true); }
    fechar() { this.aberto.set(false); }

    mudarAba(aba: SeletorAba) {
        this.abaAtiva.set(aba);
        if (aba === 'dia') {
            this.carregarListasPorData(this.dataSelecionada());
        } else if (aba === 'categoria') {
            this.carregarListasPorCategoria(this.catSelecionada());
        } else if (aba === 'minhas-listas') {
            this.carregarMinhasListas();
        }
    }

    onDataInputChange() {
        this.abaAtiva.set('dia');
        this.carregarListasPorData(this.dataSelecionada());
        const input = this.inputData.nativeElement;
        input.addEventListener('change', (e: Event) => {
            const val = (e.target as HTMLInputElement).value;
            if (val) {
                this.dataSelecionada.set(val);
                this.abaAtiva.set('dia');
                this.carregarListasPorData(val);
            }
        }, { once: true });
        try { input.showPicker(); } catch { input.click(); }
    }

    onCatChange(cat: string) {
        this.catSelecionada.set(cat);
        this.carregarListasPorCategoria(cat);
    }

    selecionar(lista: Lista) {
        this.fechar();
        this.listaSelecionada.emit(lista);
    }

    iniciarNovoRepertorio() {
        this.novoTitulo.set('');
        this.criandoRepertorio.set(true);
    }

    cancelarNovoRepertorio() {
        this.criandoRepertorio.set(false);
    }

    confirmarNovoRepertorio() {
        const titulo = this.novoTitulo().trim();
        if (!titulo || this.salvando()) return;

        const uid = this.auth.user()!.uid;
        const agora = new Date().toISOString();
        const lista: Lista = {
            id: '',
            titulo,
            musicas: [],
            tipo: 'privada' as TipoLista,
            donoUid: uid,
            donoNome: this.auth.displayName?.() || undefined,
            participantes: [],
            partes: [{ id: `parte-${Date.now()}`, label: 'Início' }],
            criadaEm: agora,
            atualizadaEm: agora,
        };

        this.salvando.set(true);
        this.listaService.salvarLista(lista).subscribe({
            next: (listaCriada) => {
                this.salvando.set(false);
                this.criandoRepertorio.set(false);
                this.minhasListas.update(l => [listaCriada, ...l]);
                this.selecionar(listaCriada);
            },
            error: () => this.salvando.set(false),
        });
    }

    formatarData(iso?: string): string {
        if (!iso) return '';
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        });
    }

    carregarDiaInicial() { this.carregarListasPorData(dataLiturgicaHoje(), true); }

    outraSugestao() {
        const lista = this.sugestaoEstavel(this.listasHoje, true);
        if (lista) this.selecionar(lista);
    }

    private sugestaoEstavel(listas: Lista[], trocar = false): Lista | undefined {
        const chave = `cifras-sugestao-${dataLiturgicaHoje()}`;
        let anterior: string | null = null;
        try { anterior = localStorage.getItem(chave); } catch { /* Storage may be disabled. */ }
        const lista = (!trocar ? listas.find(l => l.id === anterior) : undefined)
            ?? escolherSugestao(listas, trocar ? this.listaAtual()?.id : undefined);
        if (lista) {
            try { localStorage.setItem(chave, lista.id); } catch { /* Keep the selection in memory. */ }
        }
        return lista;
    }

    private carregarListasPorData(data: string, inicial = false) {
        const pedido = ++this.pedido;
        this.carregandoFiltro.set(true);
        this.erroFiltro.set('');
        this.liturgiaDoFiltro.set(null);
        forkJoin([this.listaService.getListasDodia(data), this.liturgiaService.dia(data)]).subscribe({
            next: ([listas, dia]) => {
                if (pedido !== this.pedido) return;
                this.listasDoFiltro.set(listas);
                this.liturgiaDoFiltro.set(dia);
                if (inicial) {
                    this.listasHoje = listas;
                    this.diaConsultado.emit({ data, dia, listas });
                    if (this.autoSelecionar()) {
                        const lista = this.sugestaoEstavel(listas);
                        if (lista) this.listaSelecionada.emit(lista);
                        else this.semResultadoInicial.emit();
                    }
                }
                this.carregandoFiltro.set(false);
            },
            error: () => {
                if (pedido !== this.pedido) return;
                const mensagem = 'Não foi possível carregar as sugestões. Confira a conexão e escolha uma data de 2025 a 2035.';
                this.listasDoFiltro.set([]);
                this.erroFiltro.set(mensagem);
                this.carregandoFiltro.set(false);
                if (inicial && this.autoSelecionar()) this.erroInicial.emit(mensagem);
            },
        });
    }

    private carregarListasPorCategoria(cat: string) {
        ++this.pedido;
        this.erroFiltro.set('');
        this.carregandoFiltro.set(true);
        this.listaService.getListasPorCategoria(cat).subscribe(listas => {
            this.listasDoFiltro.set(listas);
            this.carregandoFiltro.set(false);
        });
    }

    private carregarMinhasListas() {
        const uid = this.auth.user()?.uid;
        if (!uid) return;
        this.carregandoMinhasListas.set(true);
        this.listaService.getTodasMinhasListas(uid).subscribe(listas => {
            this.minhasListas.set(listas);
            this.carregandoMinhasListas.set(false);
        });
    }
}
