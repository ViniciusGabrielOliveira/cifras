import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { CifraService } from '../../services/cifra.service';
import { AuthService } from '../../services/auth.service';
import { Cifra, CifraVersao } from '../../models/cifra.model';
import { CifraViewerComponent } from '../../components/cifra-viewer/cifra-viewer';

@Component({
  selector: 'app-cifra-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CifraViewerComponent],
  templateUrl: './cifra.html',
  styleUrl: './cifra.scss',
})
export class CifraPageComponent implements OnInit {
  private cifraService = inject(CifraService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  readonly auth        = inject(AuthService);

  cifra   = signal<Cifra | null>(null);
  versoes = signal<CifraVersao[]>([]);
  loading = signal(true);
  erro    = signal(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/']); return; }

    this.cifraService.getCifra(id).subscribe(c => {
      this.cifra.set(c ?? null);
      this.erro.set(!c);
      this.loading.set(false);
    });

    this.cifraService.getVersoes(id).subscribe(v => this.versoes.set(v));
  }

  voltar() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }
}
