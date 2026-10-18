import {
  Component, Input, signal, inject, ElementRef, OnChanges, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramaViolaoComponent } from '../diagrama-violao/diagrama-violao';
import { AcordesService } from '../../services/acordes.service';
import { Subscription } from 'rxjs';
import { gerarDiagramasCavaco } from '../../core/cavaquinho';
import { DiagramaAcorde } from '../../models/diagrama.model';

@Component({
  selector: 'app-acorde-label',
  standalone: true,
  imports: [CommonModule, DiagramaViolaoComponent],
  templateUrl: './acorde-label.html',
  styleUrl: './acorde-label.scss',
})
export class AcordeLabelComponent implements OnChanges, OnDestroy {
  @Input() acorde = '';
  @Input() instrumento: 'violao' | 'cavaco' = 'violao';
  private busca?: Subscription;
  private fecharTimer?: ReturnType<typeof setTimeout>;

  showPopup = signal(false);
  carregando = signal(false);
  variacoes = signal<DiagramaAcorde[]>([]);

  private acordesService = inject(AcordesService);
  private el = inject(ElementRef);

  popupTop = 0;
  popupLeft = 0;

  onMouseEnter() {
    clearTimeout(this.fecharTimer);
    this.showPopup.set(true);
    const rect = this.el.nativeElement.getBoundingClientRect();
    
    // Estima a largura do modal do acorde (costuma ser ~160px)
    const estimatedWidth = 170;
    const viewportWidth = window.innerWidth;
    
    this.popupTop = rect.bottom + 4;
    
    // Ajusta a posição horizontal para não cortar na direita
    let calcLeft = rect.left;
    if (calcLeft + estimatedWidth > viewportWidth - 16) {
      calcLeft = viewportWidth - estimatedWidth - 16;
    }
    
    this.popupLeft = Math.max(16, calcLeft);

    this.busca?.unsubscribe();
    if (this.instrumento === 'cavaco') {
      this.variacoes.set(gerarDiagramasCavaco(this.acorde));
      this.carregando.set(false);
      return;
    }
    // Já está no cache → exibe imediatamente
    const cached = this.acordesService.getVariacoes(this.acorde);
    if (cached.length > 0) {
      this.variacoes.set(cached);
      this.carregando.set(false);
      return;
    }

    // Não está no cache → busca just-in-time
    this.carregando.set(true);
    this.variacoes.set([]);
    this.busca = this.acordesService.preCarregarAcordes([this.acorde]).subscribe({
      next: () => {
        this.variacoes.set(this.acordesService.getVariacoes(this.acorde));
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }

  ngOnChanges() {
    this.busca?.unsubscribe();
    clearTimeout(this.fecharTimer);
    this.showPopup.set(false);
    this.variacoes.set([]);
    this.carregando.set(false);
  }

  ngOnDestroy() {
    this.busca?.unsubscribe();
    clearTimeout(this.fecharTimer);
  }

  onMouseLeave() {
    this.fecharTimer = setTimeout(() => this.showPopup.set(false), 150);
  }
}
