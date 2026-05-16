import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Cifra } from '../../models/cifra.model';
import { CifraService } from '../../services/cifra.service';
import { transporCifra, calcularDelta } from '../../core/transposicao';
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  cifraOriginal = signal<Cifra | null>(null);
  delta = signal(0);
  fonteSize = signal(16);
  loading = signal(true);
  notFound = signal(false);
  observacao = signal<string | null>(null);

  cifra = computed(() => {
    const c = this.cifraOriginal();
    if (!c) return null;
    return transporCifra(c, this.delta());
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!id) { this.router.navigate(['/']); return; }

    const tomAlvo   = this.route.snapshot.queryParamMap.get('tom');
    const observacao = this.route.snapshot.queryParamMap.get('observacao');
    if (observacao) this.observacao.set(observacao);

    this.cifraService.getCifra(id).subscribe(c => {
      if (c) {
        this.cifraOriginal.set(c);
        if (tomAlvo) this.delta.set(calcularDelta(c.tom, tomAlvo));
      } else {
        this.notFound.set(true);
      }
      this.loading.set(false);
    });
  }

  mudarTom(delta: number) { this.delta.update(d => d + delta); }
  restaurarTom() { this.delta.set(0); }
  mudarFonte(delta: number) {
    this.fonteSize.update(f => Math.min(24, Math.max(12, f + delta)));
  }
}
