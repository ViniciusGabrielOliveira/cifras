import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Cifra, CifraVersao } from '../../models/cifra.model';
import { SecaoCifraComponent } from '../secao-cifra/secao-cifra';
import { transporCifra } from '../../core/transposicao';

@Component({
  selector: 'app-cifra-viewer',
  standalone: true,
  imports: [CommonModule, RouterLink, SecaoCifraComponent],
  templateUrl: './cifra-viewer.html',
  styleUrl: './cifra-viewer.scss',
})
export class CifraViewerComponent {
  cifra        = input.required<Cifra>();
  versoes      = input<CifraVersao[]>([]);
  observacao   = input<string | undefined>(undefined);
  mostrarEditar = input(false);

  delta              = signal(0);
  fonteSize          = signal(15);
  versaoSelecionada  = signal<string | null>(null);

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
