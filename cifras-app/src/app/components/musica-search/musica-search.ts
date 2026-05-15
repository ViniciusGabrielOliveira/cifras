import {
  Component, inject, signal, output, input,
  ElementRef, ViewChild, HostListener, OnDestroy, AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, from, map, catchError } from 'rxjs';
import { CifraBuscaService, ResultadoBusca } from '../../services/cifra-busca.service';
import { CifraClubImportService, CifraClubSugestao } from '../../services/cifraclub-import.service';

export type { CifraClubSugestao };

export interface MusicaSelecionada {
  cifraId: string;
  nome: string;
  autor: string;
  trecho?: string;
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

  // ── Inputs / Outputs ─────────────────────────────────────────────
  placeholder       = input('Buscar por título, trecho da letra ou autor...');
  modoEmbutido      = input(false);
  mostrarCifraClub  = input(false);

  musicaSelecionada    = output<MusicaSelecionada>();
  cadastrarNova        = output<string>();
  cifraClubSelecionada = output<CifraClubSugestao>();

  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;

  // ── Estado: busca local ──────────────────────────────────────────
  query      = signal('');
  filtroTipo = signal<'tudo' | 'titulo' | 'autor' | 'letra'>('tudo');
  resultados = signal<ResultadoBusca[]>([]);
  aberto     = signal(false);
  carregando = signal(false);
  buscou     = signal(false);
  itemFocado = signal(-1);

  // ── Estado: Cifra Club ───────────────────────────────────────────
  sugestoesCifraClub = signal<CifraClubSugestao[]>([]);
  buscandoCifraClub  = signal(false);

  // ── Pipeline busca local ─────────────────────────────────────────
  private searchParams$ = new Subject<{ q: string; f: string }>();
  private sub = this.searchParams$
    .pipe(
      debounceTime(220),
      distinctUntilChanged((a, b) => a.q === b.q && a.f === b.f),
      switchMap(({ q, f }) => {
        if (q.length < 2) {
          this.resultados.set([]);
          this.carregando.set(false);
          this.buscou.set(false);
          return of([]);
        }
        this.carregando.set(true);
        this.buscou.set(false);
        return this.buscaService.buscar(q, 20, f as 'tudo' | 'titulo' | 'autor' | 'letra');
      }),
    )
    .subscribe(res => {
      this.resultados.set(res);
      this.carregando.set(false);
      this.buscou.set(true);
      this.aberto.set(!this.modoEmbutido() && res.length > 0);
      this.itemFocado.set(-1);
    });

  // ── Pipeline Cifra Club ──────────────────────────────────────────
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
        return from(this.cifraClub.buscarSugestoes(q)).pipe(
          map(res => res.slice(0, 6)),
          catchError(() => of([])),
        );
      }),
    )
    .subscribe(res => {
      this.sugestoesCifraClub.set(res);
      this.buscandoCifraClub.set(false);
    });

  ngAfterViewInit() {
    setTimeout(() => this.inputEl?.nativeElement.focus(), 80);
  }

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.query.set(val);
    this.searchParams$.next({ q: val, f: this.filtroTipo() });
    if (this.mostrarCifraClub()) {
      this.ccQuery$.next(val);
    }
    if (val.length < 2) {
      this.aberto.set(false);
      this.resultados.set([]);
      this.buscou.set(false);
      this.sugestoesCifraClub.set([]);
    }
  }

  setFiltro(tipo: 'tudo' | 'titulo' | 'autor' | 'letra') {
    this.filtroTipo.set(tipo);
    this.searchParams$.next({ q: this.query(), f: tipo });
    if (!this.modoEmbutido()) {
      this.inputEl?.nativeElement.focus();
    }
  }

  selecionar(item: ResultadoBusca) {
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

  selecionarCifraClub(sugestao: CifraClubSugestao) {
    this.cifraClubSelecionada.emit(sugestao);
    this._limparTudo();
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
  }

  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    const res = this.resultados();
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
        this.selecionar(res[idx]);
      }
    } else if (e.key === 'Escape') {
      this.aberto.set(false);
    }
  }

  fecharDropdown() {
    if (!this.modoEmbutido()) {
      setTimeout(() => this.aberto.set(false), 150);
    }
  }

  get temResultados(): boolean {
    return this.resultados().length > 0 || this.sugestoesCifraClub().length > 0;
  }

  get estaCarregandoQualquer(): boolean {
    return this.carregando() || this.buscandoCifraClub();
  }

  badgeLabel(tipo: ResultadoBusca['matchTipo']): string {
    return { titulo: '', letra: 'letra', autor: 'autor' }[tipo];
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    this.ccSub.unsubscribe();
  }
}
