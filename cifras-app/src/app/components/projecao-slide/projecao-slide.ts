import { Component, computed, input } from '@angular/core';
import { LayoutProjecao, LAYOUT_PROJECAO_PADRAO } from '../../models/layout-projecao.model';

@Component({
  selector: 'app-projecao-slide',
  templateUrl: './projecao-slide.html',
  styleUrl: './projecao-slide.scss',
})
export class ProjecaoSlide {
  readonly letra = input('');
  readonly layout = input<LayoutProjecao>(LAYOUT_PROJECAO_PADRAO);
  readonly paragrafos = computed(() => this.letra().split('\n'));
}
