import { Component, inject, signal, input, output, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Lista, TipoLista } from '../../models/lista.model';
import { ListaService } from '../../services/lista.service';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';

type SeletorAba = 'dia' | 'categoria' | 'minhas-listas';

@Component({
    selector: 'app-seletor-repertorio',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './seletor-repertorio.html',
    styleUrl: './seletor-repertorio.scss',
})
export class SeletorRepertorioComponent implements OnInit {
    private listaService = inject(ListaService);
    private configService = inject(ConfigService);
    readonly auth = inject(AuthService);

    @ViewChild('inputData') inputData!: ElementRef<HTMLInputElement>;

    readonly listaAtual    = input<Lista | null>(null);
    readonly autoSelecionar = input(true);

    readonly listaSelecionada    = output<Lista>();
    readonly semResultadoInicial = output<void>();

    readonly aberto               = signal(false);
    readonly abaAtiva             = signal<SeletorAba>('dia');
    readonly dataSelecionada      = signal(new Date().toISOString().split('T')[0]);
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

        const uid = this.auth.user()?.uid!;
        const agora = new Date().toISOString();
        const lista: Lista = {
            id: '',
            titulo,
            categoria: 'tempo-comum',
            musicas: [],
            tipo: 'privada' as TipoLista,
            donoUid: uid,
            donoNome: this.auth.displayName?.() || undefined,
            participantes: [],
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

    private carregarListasPorData(data: string, inicial = false) {
        this.carregandoFiltro.set(true);
        this.listaService.getListasDodia(data).subscribe(listas => {
            this.listasDoFiltro.set(listas);
            if (inicial && this.autoSelecionar()) {
                if (!this.listaAtual() && listas.length > 0) {
                    this.listaSelecionada.emit(listas[0]);
                } else if (!this.listaAtual()) {
                    this.semResultadoInicial.emit();
                }
            }
            this.carregandoFiltro.set(false);
        });
    }

    private carregarListasPorCategoria(cat: string) {
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
