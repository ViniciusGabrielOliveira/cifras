import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CifraPR, Cifra, Secao, MOTIVOS_VERSAO } from '../../../models/cifra.model';
import { CifraService } from '../../../services/cifra.service';
import { AuthService } from '../../../services/auth.service';
import { cifraToTexto } from '../../../core/cifra-parser';

interface LinhasDiff {
  tipo: 'igual' | 'removida' | 'adicionada';
  texto: string;
}

@Component({
  selector: 'app-prs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prs.html',
  styleUrl: './prs.scss',
})
export class PrsComponent implements OnInit {
  private cifraService = inject(CifraService);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly prs = signal<CifraPR[]>([]);
  readonly carregando = signal(true);
  readonly prSelecionada = signal<CifraPR | null>(null);
  readonly cifraOriginal = signal<Cifra | null>(null);
  readonly diff = signal<LinhasDiff[]>([]);
  readonly notaRejeicao = signal('');
  readonly resolvendo = signal(false);
  readonly erroMsg = signal<string | null>(null);
  readonly notificacao = signal<string | null>(null);

  readonly motivoLabel = computed(() => {
    const pr = this.prSelecionada();
    if (!pr?.motivo) return null;
    return pr.motivo === 'outros'
      ? pr.motivoCustom || 'Outros'
      : MOTIVOS_VERSAO[pr.motivo];
  });

  ngOnInit() {
    this.cifraService.getPRsPendentes().subscribe({
      next: prs => {
        this.prs.set(prs.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)));
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }

  abrirPR(pr: CifraPR) {
    this.prSelecionada.set(pr);
    this.notaRejeicao.set('');
    this.diff.set([]);
    this.cifraOriginal.set(null);

    if (pr.tipo === 'nova_versao' && pr.cifraId) {
      this.cifraService.getCifra(pr.cifraId).subscribe(cifra => {
        if (cifra) {
          this.cifraOriginal.set(cifra);
          this.diff.set(this.calcularDiff(cifra, pr));
        }
      });
    } else {
      this.diff.set(this.calcularDiff(null, pr));
    }
  }

  fecharPR() {
    this.prSelecionada.set(null);
    this.cifraOriginal.set(null);
  }

  aprovar() {
    const pr = this.prSelecionada();
    if (!pr) return;
    const uid = this.auth.user()?.uid ?? '';
    this.resolvendo.set(true);
    this.cifraService.aprovarPR(pr, uid).subscribe({
      next: () => {
        this.prs.update(list => list.filter(p => p.id !== pr.id));
        this.fecharPR();
        this.resolvendo.set(false);
        this.mostrarNotificacao('Cifra aprovada e publicada!');
      },
      error: (err: Error) => {
        this.resolvendo.set(false);
        this.erroMsg.set(err.message || 'Erro ao aprovar.');
        setTimeout(() => this.erroMsg.set(null), 5000);
      },
    });
  }

  rejeitar() {
    const pr = this.prSelecionada();
    if (!pr) return;
    const uid = this.auth.user()?.uid ?? '';
    this.resolvendo.set(true);
    this.cifraService.rejeitarPR(pr.id, uid, this.notaRejeicao() || undefined).subscribe({
      next: () => {
        this.prs.update(list => list.filter(p => p.id !== pr.id));
        this.fecharPR();
        this.resolvendo.set(false);
        this.mostrarNotificacao('PR rejeitada.');
      },
      error: (err: Error) => {
        this.resolvendo.set(false);
        this.erroMsg.set(err.message || 'Erro ao rejeitar.');
        setTimeout(() => this.erroMsg.set(null), 5000);
      },
    });
  }

  private calcularDiff(original: Cifra | null, pr: CifraPR): LinhasDiff[] {
    const textoNovo = cifraToTexto(pr.dados.secoes as Secao[]);
    const linhasNovas = textoNovo.split('\n');

    if (!original) {
      return linhasNovas.map(texto => ({ tipo: 'adicionada', texto }));
    }

    const textoAntigo = cifraToTexto(original.secoes);
    const linhasAntigas = textoAntigo.split('\n');

    return this.lcs(linhasAntigas, linhasNovas);
  }

  private lcs(antigas: string[], novas: string[]): LinhasDiff[] {
    const m = antigas.length;
    const n = novas.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = antigas[i - 1] === novas[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const resultado: LinhasDiff[] = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && antigas[i - 1] === novas[j - 1]) {
        resultado.unshift({ tipo: 'igual', texto: antigas[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        resultado.unshift({ tipo: 'adicionada', texto: novas[j - 1] });
        j--;
      } else {
        resultado.unshift({ tipo: 'removida', texto: antigas[i - 1] });
        i--;
      }
    }
    return resultado;
  }

  private mostrarNotificacao(msg: string) {
    this.notificacao.set(msg);
    setTimeout(() => this.notificacao.set(null), 3000);
  }

  formatarData(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }
}
