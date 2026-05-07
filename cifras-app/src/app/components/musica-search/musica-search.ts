import {
  Component, inject, signal, output, input,
  ElementRef, ViewChild, HostListener, OnDestroy, AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { CifraBuscaService, ResultadoBusca } from '../../services/cifra-busca.service';

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

  // ── Inputs / Outputs ─────────────────────────────────────────────
  placeholder   = input('Buscar por título, trecho da letra ou autor...');
  /** Quando true, resultados ficam na página (sem dropdown flutuante) */
  modoEmbutido  = input(false);
  /** Emite a música selecionada */
  musicaSelecionada = output<MusicaSelecionada>();
  /** Emite quando usuário quer cadastrar uma nova música (sem resultado) */
  cadastrarNova     = output<string>(); // emite o texto que foi buscado

  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;

  // ── Estado ───────────────────────────────────────────────────────
  query      = signal('');
  filtroTipo = signal<'tudo' | 'titulo' | 'autor' | 'letra'>('tudo');
  resultados = signal<ResultadoBusca[]>([]);
  aberto     = signal(false);
  carregando = signal(false);
  buscou     = signal(false);   // true depois de ao menos uma busca com ≥2 chars
  itemFocado = signal(-1);

  private searchParams$ = new Subject<{ q: string; f: string }>();
  private sub = this.searchParams$
    .pipe(
      debounceTime(220),
      distinctUntilChanged((prev, curr) => prev.q === curr.q && prev.f === curr.f),
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

  ngAfterViewInit() {
    // Foca automaticamente ao abrir
    setTimeout(() => this.inputEl?.nativeElement.focus(), 80);
  }

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.query.set(val);
    this.searchParams$.next({ q: val, f: this.filtroTipo() });
    if (val.length < 2) {
      this.aberto.set(false);
      this.resultados.set([]);
      this.buscou.set(false);
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
      trecho:  t || 'Trecho indisponível'
    });
    this.query.set('');
    this.aberto.set(false);
    this.resultados.set([]);
    this.buscou.set(false);
    this.itemFocado.set(-1);
  }

  onCadastrarNova() {
    this.cadastrarNova.emit(this.query());
  }

  limpar() {
    this.query.set('');
    this.aberto.set(false);
    this.resultados.set([]);
    this.buscou.set(false);
    this.inputEl?.nativeElement.focus();
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

  badgeLabel(tipo: ResultadoBusca['matchTipo']): string {
    return { titulo: '', letra: 'letra', autor: 'autor' }[tipo];
  }

  ngOnDestroy() { this.sub.unsubscribe(); }
}
