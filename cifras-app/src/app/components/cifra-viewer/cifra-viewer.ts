import { Component, computed, inject, input, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Cifra, CifraVersao } from '../../models/cifra.model';
import { SecaoCifraComponent } from '../secao-cifra/secao-cifra';
import { transporCifra } from '../../core/transposicao';

function extrairYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

@Component({
  selector: 'app-cifra-viewer',
  standalone: true,
  imports: [CommonModule, RouterLink, SecaoCifraComponent],
  templateUrl: './cifra-viewer.html',
  styleUrl: './cifra-viewer.scss',
})
export class CifraViewerComponent implements OnDestroy {
  private sanitizer = inject(DomSanitizer);

  cifra         = input.required<Cifra>();
  versoes       = input<CifraVersao[]>([]);
  observacao    = input<string | undefined>(undefined);
  mostrarEditar = input(false);

  delta             = signal(0);
  fonteSize         = signal(15);
  versaoSelecionada = signal<string | null>(null);
  playerAberto      = signal(false);
  scrollAtivo       = signal(false);
  velocidade        = signal(3);
  painelAberto      = signal(false);
  painelX           = signal(16);
  painelY           = signal(80);

  private _rafId?: number;
  private _lastTime?: number;
  private _arrastando = false;
  private _offsetX = 0;
  private _offsetY = 0;
  private _onMouseMove = (e: MouseEvent) => this.moverPainel(e.clientX, e.clientY);
  private _onMouseUp   = () => this.pararArrasto();
  private _onTouchMove = (e: TouchEvent) => {
    if (!this._arrastando) return;
    e.preventDefault();
    this.moverPainel(e.touches[0].clientX, e.touches[0].clientY);
  };
  private _onTouchEnd = () => this.pararArrasto();

  youtubeEmbedUrl = computed((): SafeResourceUrl | null => {
    const link = this.cifra().videoLink;
    if (!link) return null;
    const id = extrairYoutubeId(link);
    if (!id) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${id}?rel=0`
    );
  });

  cifraExibida = computed(() => {
    const versaoId = this.versaoSelecionada();
    const base = versaoId ? this.aplicarVersao(versaoId) : this.cifra();
    return transporCifra(base, this.delta());
  });

  private aplicarVersao(versaoId: string): Cifra {
    const versao = this.versoes().find(v => v.id === versaoId);
    return versao ? { ...this.cifra(), secoes: versao.secoes, tom: versao.tom } : this.cifra();
  }

  mudarTom(d: number)   { this.delta.update(v => v + d); }
  restaurarTom()        { this.delta.set(0); }
  mudarFonte(d: number) { this.fonteSize.update(v => Math.min(24, Math.max(12, v + d))); }

  selecionarVersao(versaoId: string | null) {
    this.versaoSelecionada.set(versaoId);
    this.delta.set(0);
  }

  formatarDataVersao(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  // ── Painel flutuante ────────────────────────────────────────────

  abrirPainel() {
    this.painelAberto.set(true);
  }

  fecharPainel() {
    this.pararScroll();
    this.painelAberto.set(false);
  }

  iniciarArrasto(event: MouseEvent) {
    const el = (event.currentTarget as HTMLElement);
    this._arrastando = true;
    this._offsetX = event.clientX - el.getBoundingClientRect().left;
    this._offsetY = event.clientY - el.getBoundingClientRect().top;
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  iniciarArrastoTouch(event: TouchEvent) {
    const el = (event.currentTarget as HTMLElement);
    this._arrastando = true;
    this._offsetX = event.touches[0].clientX - el.getBoundingClientRect().left;
    this._offsetY = event.touches[0].clientY - el.getBoundingClientRect().top;
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd);
  }

  private moverPainel(clientX: number, clientY: number) {
    if (!this._arrastando) return;
    const panelW = 220;
    const panelH = 110;
    const newX = Math.max(0, Math.min(window.innerWidth - panelW, clientX - this._offsetX));
    const newY = Math.max(0, Math.min(window.innerHeight - panelH, clientY - this._offsetY));
    this.painelX.set(newX);
    this.painelY.set(newY);
  }

  private pararArrasto() {
    this._arrastando = false;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);
  }

  // ── Auto scroll ─────────────────────────────────────────────────

  toggleScroll() {
    if (this.scrollAtivo()) {
      this.pararScroll();
    } else {
      this.scrollAtivo.set(true);
      this._lastTime = undefined;
      document.documentElement.style.scrollBehavior = 'auto';
      this._rafId = requestAnimationFrame(t => this.loop(t));
    }
  }

  private loop(timestamp: number) {
    if (!this.scrollAtivo()) return;

    if (this._lastTime !== undefined) {
      const elapsed = timestamp - this._lastTime;
      // velocidade 1–10 → ~20–200 px/s
      document.documentElement.scrollTop += (this.velocidade() * 20 * elapsed) / 1000;
    }
    this._lastTime = timestamp;

    const el = document.documentElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
      this.pararScroll();
      return;
    }

    this._rafId = requestAnimationFrame(t => this.loop(t));
  }

  private pararScroll() {
    this.scrollAtivo.set(false);
    document.documentElement.style.scrollBehavior = '';
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  mudarVelocidade(d: number) {
    this.velocidade.update(v => Math.min(10, Math.max(1, v + d)));
  }

  onToqueCifra(event: Event) {
    if (!this.scrollAtivo()) return;
    const alvo = event.target as HTMLElement;
    if (alvo.closest('button, a, select')) return;
    event.preventDefault();
    // Volta 70% da tela para reler a parte que passou
    document.documentElement.scrollTop -= window.innerHeight * 0.7;
  }

  ngOnDestroy() {
    this.pararScroll();
    this.pararArrasto();
  }
}
