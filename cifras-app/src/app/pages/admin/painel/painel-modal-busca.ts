import { Component, input, output } from '@angular/core';
import { MusicaSearchComponent, MusicaSelecionada } from '../../../components/musica-search/musica-search';

@Component({
  selector: 'app-painel-modal-busca',
  standalone: true,
  imports: [MusicaSearchComponent],
  templateUrl: './painel-modal-busca.html',
  styleUrl: './painel-modal-busca.scss',
})
export class PainelModalBuscaComponent {
  parte        = input.required<string>();
  partesLabels = input.required<Record<string, string | undefined>>();
  erro         = input<string | null>(null);

  fechar            = output<void>();
  musicaSelecionada = output<MusicaSelecionada>();
  cadastrarNova     = output<string>();
  limparErro        = output<void>();
}
