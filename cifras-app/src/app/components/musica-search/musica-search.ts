import {
  Component, inject, signal, computed, output, input,
  ElementRef, ViewChild, HostListener, OnDestroy, AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError, EMPTY } from 'rxjs';
import { CifraBuscaService, ResultadoBusca } from '../../services/cifra-busca.service';
import { CifraClubImportService, CifraClubSugestao } from '../../services/cifraclub-import.service';
import { ConfigService } from '../../services/config.service';
import { Cifra } from '../../models/cifra.model';

export type { CifraClubSugestao };

export interface MusicaSelecionada {
  cifraId: string;
  nome: string;
  autor: string;
  trecho?: string;
  cifra?: Cifra; // disponível quando importada do CifraClub
}

export interface ItemResultado extends ResultadoBusca {
  fromWeb?: boolean;
  webSugestao?: CifraClubSugestao;
}

interface SearchParams {
  q: string;
  f: string;
  cats: string[];
  partes: string[];
}

function norm(s: string): string {
  return (s ?? '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

@Component({
  selector: 'app-musica-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './musica-search.html',
  styleUrl: './musica-search.scss',
})
export class MusicaSearchComponent implements OnDestroy, AfterViewInit {
  private buscaService = inject(CifraBuscaService);
  private cifraClub    = inject(CifraClubImportService);
  readonly config      = inject(ConfigService);

  // ── Inputs / Outputs ─────────────────────────────────────────────
  placeholder   = input('Buscar por título, trecho da letra ou autor...');
  modoEmbutido  = input(false);
  mostrarFiltros = input(false);
  // Controle de acesso à busca web — true por padrão, pode ser restringido no futuro
  mostrarCifraClub = input(true);

  musicaSelecionada = output<MusicaSelecionada>();
  cadastrarNova     = output<string>();

  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;

  // ── Estado ───────────────────────────────────────────────────────
  query             = signal('');
  filtroTipo        = signal<'tudo' | 'titulo' | 'autor' | 'letra'>('tudo');
  filtrosCategorias = signal<string[]>([]);
  filtrosPartes     = signal<string[]>([]);
  resultados        = signal<ResultadoBusca[]>([]);
  aberto            = signal(false);
  carregando        = signal(false);
  buscou            = signal(false);
  itemFocado        = signal(-1);
  importando        = signal(false);
  erroImport        = signal<string | null>(null);

  sugestoesCifraClub = signal<CifraClubSugestao[]>([]);
  buscandoCifraClub  = signal(false);

  // ── Resultados mesclados (banco + web sem duplicatas) ────────────
  resultadosMesclados = computed<ItemResultado[]>(() => {
    const local = this.resultados();
    const web   = this.mostrarCifraClub() ? this.sugestoesCifraClub() : [];

    const localKeys = new Set(local.map(r => norm(r.titulo) + '|' + norm(r.autor)));
    const localTitles = new Set(local.map(r => norm(r.titulo)));

    const webNovos: ItemResultado[] = web
      .filter(s =>
        !localKeys.has(norm(s.nome) + '|' + norm(s.artista)) &&
        !localTitles.has(norm(s.nome))
      )
      .map(s => ({
        id:          `web-${s.id}`,
        titulo:      s.nome,
        autor:       s.artista,
        letra:       '',
        score:       0,
        matchTipo:   'titulo' as const,
        fromWeb:     true,
        webSugestao: s,
      }));

    return [...local, ...webNovos];
  });

  // ── Pipeline busca local ─────────────────────────────────────────
  private searchParams$ = new Subject<SearchParams>();
  private sub = this.searchParams$
    .pipe(
      debounceTime(220),
      distinctUntilChanged((a, b) =>
        a.q === b.q && a.f === b.f &&
        JSON.stringify(a.cats) === JSON.stringify(b.cats) &&
        JSON.stringify(a.partes) === JSON.stringify(b.partes)
      ),
      switchMap(({ q, f, cats, partes }) => {
        const hasText    = q.length >= 2;
        const hasFilters = cats.length > 0 || partes.length > 0;
        if (!hasText && !hasFilters) {
          this.resultados.set([]);
          this.carregando.set(false);
          this.buscou.set(false);
          return EMPTY;
        }
        this.carregando.set(true);
        this.buscou.set(false);
        return this.buscaService.buscar(q, 20, f as 'tudo' | 'titulo' | 'autor' | 'letra', cats, partes).pipe(
          catchError(() => of([])),
        );
      }),
    )
    .subscribe(res => {
      this.resultados.set(res);
      this.carregando.set(false);
      this.buscou.set(true);
      this.aberto.set(!this.modoEmbutido() && res.length > 0);
      this.itemFocado.set(-1);
    });

  // ── Pipeline busca web ───────────────────────────────────────────
  private ccQuery$ = new Subject<string>();
  private ccSub = this.ccQuery$
    .pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2 || !this.mostrarCifraClub()) {
          this.sugestoesCifraClub.set([]);
          this.buscandoCifraClub.set(false);
          return of([]);
        }
        this.buscandoCifraClub.set(true);
        return this.cifraClub.buscarSugestoes(q).pipe(
          catchError(() => of([])),
        );
      }),
    )
    .subscribe(res => {
      this.sugestoesCifraClub.set(res.slice(0, 6));
      this.buscandoCifraClub.set(false);
    });

  ngAfterViewInit() {
    setTimeout(() => this.inputEl?.nativeElement.focus(), 80);
  }

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.query.set(val);
    this.erroImport.set(null);
    this._dispararBusca(val);
    this.ccQuery$.next(val);
    if (val.length < 2 && !this.temFiltrosAtivos) {
      this.aberto.set(false);
      this.resultados.set([]);
      this.buscou.set(false);
      this.sugestoesCifraClub.set([]);
    }
  }

  setFiltro(tipo: 'tudo' | 'titulo' | 'autor' | 'letra') {
    this.filtroTipo.set(tipo);
    this._dispararBusca();
    if (!this.modoEmbutido()) this.inputEl?.nativeElement.focus();
  }

  onSelecionarParte(event: Event) {
    const sel = event.target as HTMLSelectElement;
    const id = sel.value;
    if (id && !this.filtrosPartes().includes(id)) {
      this.filtrosPartes.update(arr => [...arr, id]);
      this._dispararBusca();
    }
    sel.value = '';
  }

  onSelecionarCategoria(event: Event) {
    const sel = event.target as HTMLSelectElement;
    const id = sel.value;
    if (id && !this.filtrosCategorias().includes(id)) {
      this.filtrosCategorias.update(arr => [...arr, id]);
      this._dispararBusca();
    }
    sel.value = '';
  }

  removerParte(id: string) {
    this.filtrosPartes.update(arr => arr.filter(x => x !== id));
    this._dispararBusca();
  }

  removerCategoria(id: string) {
    this.filtrosCategorias.update(arr => arr.filter(x => x !== id));
    this._dispararBusca();
  }

  private _dispararBusca(q = this.query()) {
    this.searchParams$.next({
      q,
      f: this.filtroTipo(),
      cats: this.filtrosCategorias(),
      partes: this.filtrosPartes(),
    });
  }

  // ── Seleção unificada ────────────────────────────────────────────

  selecionarItem(item: ItemResultado) {
    if (item.fromWeb && item.webSugestao) {
      this._importarESalvar(item.webSugestao);
    } else {
      this._selecionarLocal(item);
    }
  }

  private _selecionarLocal(item: ResultadoBusca) {
    let t = item.trechoMatch;
    if (!t && item.letra) {
      const words = item.letra.split(' ');
      t = words.slice(0, 15).join(' ');
      if (t.length > 0) t += '...';
    }
    this.musicaSelecionada.emit({
      cifraId: item.id,
      nome:    item.titulo,
      autor:   item.autor,
      trecho:  t || 'Trecho indisponível',
    });
    this._limparTudo();
  }

  private async _importarESalvar(sugestao: CifraClubSugestao) {
    this.importando.set(true);
    this.erroImport.set(null);
    try {
      const cifra = await this.cifraClub.importarESalvar(sugestao);
      this.musicaSelecionada.emit({
        cifraId: cifra.id,
        nome:    sugestao.nome,
        autor:   sugestao.artista,
        cifra,
      });
      this._limparTudo();
    } catch {
      this.erroImport.set('Não foi possível importar a música. Tente novamente.');
    } finally {
      this.importando.set(false);
    }
  }

  onCadastrarNova() {
    this.cadastrarNova.emit(this.query());
  }

  limpar() {
    this._limparTudo();
    this.inputEl?.nativeElement.focus();
  }

  private _limparTudo() {
    this.query.set('');
    this.aberto.set(false);
    this.resultados.set([]);
    this.buscou.set(false);
    this.itemFocado.set(-1);
    this.sugestoesCifraClub.set([]);
    this.buscandoCifraClub.set(false);
    this.erroImport.set(null);
  }

  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    const res = this.resultadosMesclados();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.itemFocado.update(i => Math.min(i + 1, res.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.itemFocado.update(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const idx = this.itemFocado();
      if (idx >= 0 && res[idx]) {
        e.preventDefault();
        this.selecionarItem(res[idx]);
      }
    } else if (e.key === 'Escape') {
      this.aberto.set(false);
    }
  }

  fecharDropdown() {
    if (!this.modoEmbutido()) setTimeout(() => this.aberto.set(false), 150);
  }

  get temResultados(): boolean {
    return this.resultadosMesclados().length > 0;
  }

  get estaCarregandoQualquer(): boolean {
    return this.carregando() || this.buscandoCifraClub();
  }

  get temFiltrosAtivos(): boolean {
    return this.filtrosCategorias().length > 0 || this.filtrosPartes().length > 0;
  }

  badgeLabel(tipo: ResultadoBusca['matchTipo']): string {
    return { titulo: '', letra: 'letra', autor: 'autor' }[tipo];
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    this.ccSub.unsubscribe();
  }
}
