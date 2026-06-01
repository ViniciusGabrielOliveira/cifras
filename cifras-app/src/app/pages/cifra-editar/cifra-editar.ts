import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';
import { CifraService } from '../../services/cifra.service';
import { AuthService } from '../../services/auth.service';
import { Cifra, CifraCustom } from '../../models/cifra.model';
import { SecaoCifraComponent } from '../../components/secao-cifra/secao-cifra';
import { parseCifraTexto, cifraToTexto } from '../../core/cifra-parser';

@Component({
  selector: 'app-cifra-editar',
  standalone: true,
  imports: [CommonModule, SecaoCifraComponent],
  templateUrl: './cifra-editar.html',
  styleUrl: './cifra-editar.scss',
})
export class CifraEditarComponent implements OnInit {
  private cifraService = inject(CifraService);
  readonly auth        = inject(AuthService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);

  cifra             = signal<Cifra | null>(null);
  cifraCustomBase   = signal<CifraCustom | null>(null);
  loading           = signal(true);
  erro              = signal(false);
  textoCifra        = signal('');
  modoPreview = signal(false);
  salvando    = signal(false);
  prEnviado   = signal(false);
  erroSalvar  = signal('');

  secoesPreview = computed(() => parseCifraTexto(this.textoCifra()));

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/']); return; }

    const uid = this.auth.user()?.uid;
    if (!uid) { this.router.navigate(['/admin']); return; }

    this.cifraService.getCifra(id).pipe(
      switchMap(c => {
        if (!c) throw new Error('not_found');
        this.cifra.set(c);
        return this.cifraService.getCifraCustom(uid, id);
      }),
    ).subscribe({
      next: custom => {
        const c = this.cifra()!;
        if (custom) {
          this.cifraCustomBase.set(custom);
          this.textoCifra.set(cifraToTexto(custom.secoes));
        } else {
          this.textoCifra.set(cifraToTexto(c.secoes));
        }
        this.loading.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.loading.set(false);
      },
    });
  }

  voltar() {
    const id = this.cifra()?.id;
    if (id) this.router.navigate(['/cifra', id]);
    else window.history.back();
  }

  salvar() {
    const cifra = this.cifra();
    const user = this.auth.user();
    if (!cifra || !user || this.salvando()) return;

    const novasSecoes = this.secoesPreview();
    const now = new Date().toISOString();

    const custom: CifraCustom = {
      id: `${user.uid}_${cifra.id}`,
      uid: user.uid,
      cifraId: cifra.id,
      secoes: novasSecoes,
      pendente_revisao: true,
      criadoEm: this.cifraCustomBase()?.criadoEm ?? now,
      atualizadoEm: now,
    };

    // Constrói explicitamente para não incluir campos undefined (Firebase rejeita)
    const cifraEditada: Omit<Cifra, 'id' | 'listasIds'> = {
      titulo: cifra.titulo,
      artista: cifra.artista,
      tom: cifra.tom,
      instrumento: cifra.instrumento,
      dificuldade: cifra.dificuldade,
      composicao: cifra.composicao,
      secoes: novasSecoes,
      ...(cifra.videoLink    !== undefined ? { videoLink: cifra.videoLink }       : {}),
      ...(cifra.sourceUrl    !== undefined ? { sourceUrl: cifra.sourceUrl }       : {}),
      ...(cifra.categorias   !== undefined ? { categorias: cifra.categorias }     : {}),
      ...(cifra.partesMissa  !== undefined ? { partesMissa: cifra.partesMissa }   : {}),
      ...(cifra.nota         !== undefined ? { nota: cifra.nota }                 : {}),
      ...(cifra.notaDetalhe  !== undefined ? { notaDetalhe: cifra.notaDetalhe }   : {}),
      ...(cifra.status       !== undefined ? { status: cifra.status }             : {}),
      ...(cifra.donoUid      !== undefined ? { donoUid: cifra.donoUid }           : {}),
    };

    this.salvando.set(true);
    this.erroSalvar.set('');

    this.cifraService.salvarCifraCustom(custom).pipe(
      switchMap(() => this.cifraService.submeterPR(
        cifraEditada,
        cifra.id,
        user.uid,
        user.displayName,
      )),
    ).subscribe({
      next: () => {
        this.cifraCustomBase.set(custom);
        this.salvando.set(false);
        this.prEnviado.set(true);
      },
      error: (err) => {
        console.error('[cifra-editar] erro ao salvar:', err);
        this.salvando.set(false);
        this.erroSalvar.set('Erro ao salvar. Tente novamente.');
      },
    });
  }
}
