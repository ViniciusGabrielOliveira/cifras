import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProjecaoSlide } from '../../components/projecao-slide/projecao-slide';
import { LayoutProjecao, LAYOUT_PROJECAO_PADRAO, normalizarLayout } from '../../models/layout-projecao.model';

@Component({
  selector: 'app-tela-projecao',
  imports: [ProjecaoSlide],
  templateUrl: './tela-projecao.html',
  styleUrl: './tela-projecao.scss',
})
export class TelaProjecao implements OnInit {
  private readonly sessao = inject(ActivatedRoute).snapshot.queryParamMap.get('sessao');
  readonly letra = signal('');
  readonly layout = signal<LayoutProjecao>({ ...LAYOUT_PROJECAO_PADRAO });
  readonly controles = signal(true);
  readonly erro = signal('');

  ngOnInit() {
    window.opener?.postMessage({ tipo: 'projecao-pronta', sessao: this.sessao }, window.location.origin);
  }

  @HostListener('window:message', ['$event'])
  receber(event: MessageEvent) {
    if (event.origin !== window.location.origin || !window.opener || event.source !== window.opener || !this.sessao || event.data?.sessao !== this.sessao) return;
    if (event.data?.tipo === 'projecao-slide' && typeof event.data.letra === 'string') {
      this.letra.set(event.data.letra);
      if (event.data.layout) this.layout.set(normalizarLayout(event.data.layout));
      this.controles.set(false);
    }
  }

  @HostListener('document:fullscreenchange')
  telaCheiaAlterada() { this.controles.set(!document.fullscreenElement); }

  @HostListener('window:keydown', ['$event'])
  teclado(event: KeyboardEvent) {
    if (event.key.toLowerCase() === 'f') void this.telaCheia();
  }

  async telaCheia() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      this.erro.set('');
    } catch { this.erro.set('Use a opção de tela cheia do navegador.'); }
  }
}
