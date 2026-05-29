import { Component, computed, inject, input, signal } from '@angular/core';
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
export class CifraViewerComponent {
  private sanitizer = inject(DomSanitizer);

  cifra        = input.required<Cifra>();
  versoes      = input<CifraVersao[]>([]);
  observacao   = input<string | undefined>(undefined);
  mostrarEditar = input(false);

  delta              = signal(0);
  fonteSize          = signal(15);
  versaoSelecionada  = signal<string | null>(null);
  playerAberto       = signal(false);

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

  mudarTom(d: number)    { this.delta.update(v => v + d); }
  restaurarTom()         { this.delta.set(0); }
  mudarFonte(d: number)  { this.fonteSize.update(v => Math.min(24, Math.max(12, v + d))); }

  selecionarVersao(versaoId: string | null) {
    this.versaoSelecionada.set(versaoId);
    this.delta.set(0);
  }

  formatarDataVersao(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  }
}
