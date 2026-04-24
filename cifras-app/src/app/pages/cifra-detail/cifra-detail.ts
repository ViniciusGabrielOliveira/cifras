import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Cifra } from '../../models/cifra.model';
import { CifraService } from '../../services/cifra';
import { transporCifra } from '../../core/transposicao';
import { SecaoCifraComponent } from '../../components/secao-cifra/secao-cifra';

@Component({
  selector: 'app-cifra-detail',
  standalone: true,
  imports: [CommonModule, SecaoCifraComponent, RouterLink],
  templateUrl: './cifra-detail.html',
  styleUrl: './cifra-detail.scss',
})
export class CifraDetailComponent implements OnInit {
  private cifraService = inject(CifraService);

  cifraOriginal = signal<Cifra | null>(null);
  delta = signal(0);
  fonteSize = signal(16);
  loading = signal(true);

  cifra = computed(() => {
    const c = this.cifraOriginal();
    if (!c) return null;
    return transporCifra(c, this.delta());
  });

  ngOnInit() {
    this.cifraService.getCifra('harpa-crista-porque-ele-vive').subscribe(c => {
      if (c) this.cifraOriginal.set(c);
      this.loading.set(false);
    });
  }

  mudarTom(delta: number) { this.delta.update(d => d + delta); }
  restaurarTom() { this.delta.set(0); }
  mudarFonte(delta: number) {
    this.fonteSize.update(f => Math.min(24, Math.max(12, f + delta)));
  }
}
