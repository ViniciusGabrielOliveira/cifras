import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MotivoVersao, MOTIVOS_VERSAO } from '../../models/cifra.model';

export type FluxoPR = 'nova_cifra' | 'nova_versao';

export interface ResultadoPRModal {
  acao: 'submeter_pr' | 'salvar_privada' | 'cancelar';
  motivo?: MotivoVersao;
  motivoCustom?: string;
}

@Component({
  selector: 'app-cifra-pr-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cifra-pr-modal.html',
  styleUrl: './cifra-pr-modal.scss',
})
export class CifraPrModalComponent {
  readonly fluxo = input.required<FluxoPR>();
  readonly tituloCifra = input('');
  readonly submitting = input(false);

  readonly resultado = output<ResultadoPRModal>();

  // Passos: 'inicio' | 'motivo' | 'confirmacao'
  readonly passo = signal<'inicio' | 'motivo' | 'confirmacao'>('inicio');
  readonly motivoSelecionado = signal<MotivoVersao | null>(null);
  readonly motivoCustom = signal('');

  readonly motivos = Object.entries(MOTIVOS_VERSAO) as [MotivoVersao, string][];

  readonly motivoValido = computed(() => {
    const m = this.motivoSelecionado();
    if (!m) return false;
    if (m === 'outros') return this.motivoCustom().trim().length > 0;
    return true;
  });

  // ── Fluxo nova_cifra ─────────────────────────────────────────────

  confirmarNovaPublica() {
    this.resultado.emit({ acao: 'submeter_pr' });
  }

  salvarPrivada() {
    this.resultado.emit({ acao: 'salvar_privada' });
  }

  // ── Fluxo nova_versao ────────────────────────────────────────────

  irParaMotivo() {
    this.passo.set('motivo');
  }

  selecionarMotivo(motivo: MotivoVersao) {
    this.motivoSelecionado.set(motivo);
    if (motivo !== 'outros') this.motivoCustom.set('');
  }

  confirmarNovaVersao() {
    if (!this.motivoValido()) return;
    this.resultado.emit({
      acao: 'submeter_pr',
      motivo: this.motivoSelecionado()!,
      motivoCustom: this.motivoSelecionado() === 'outros' ? this.motivoCustom() : undefined,
    });
  }

  cancelar() {
    this.resultado.emit({ acao: 'cancelar' });
  }

  voltar() {
    this.passo.set('inicio');
    this.motivoSelecionado.set(null);
    this.motivoCustom.set('');
  }
}
