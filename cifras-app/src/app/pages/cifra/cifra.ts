import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { CifraService } from '../../services/cifra.service';
import { AuthService } from '../../services/auth.service';
import { Cifra, CifraCustom, CifraVersao } from '../../models/cifra.model';
import { CifraViewerComponent } from '../../components/cifra-viewer/cifra-viewer';

@Component({
  selector: 'app-cifra-page',
  standalone: true,
  imports: [CommonModule, CifraViewerComponent],
  templateUrl: './cifra.html',
  styleUrl: './cifra.scss',
})
export class CifraPageComponent implements OnInit {
  private cifraService = inject(CifraService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  readonly auth        = inject(AuthService);
  private destroyRef   = inject(DestroyRef);

  cifra        = signal<Cifra | null>(null);
  cifraCustom  = signal<CifraCustom | null>(null);
  versoes      = signal<CifraVersao[]>([]);
  loading      = signal(true);
  erro         = signal(false);

  cifraEfetiva = computed(() => {
    const c = this.cifra();
    if (!c) return null;
    const custom = this.cifraCustom();
    return custom ? { ...c, secoes: custom.secoes } : c;
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/']); return; }

    this.cifraService.getCifra(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(c => {
        this.cifra.set(c ?? null);
        this.erro.set(!c);
        this.loading.set(false);
      });

    this.cifraService.getVersoes(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.versoes.set(v));

    const uid = this.auth.user()?.uid;
    if (uid) {
      this.cifraService.getCifraCustom(uid, id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(custom => {
          this.cifraCustom.set(custom ?? null);
        });
    }
  }

  voltar() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }
}
