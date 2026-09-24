import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ProjecaoService } from '../../services/projecao.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ListaProjecao } from '../../models/projecao.model';

@Component({
  selector: 'app-listas-projecao',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './listas-projecao.html',
  styleUrl: './listas-projecao.scss',
})
export class ListasProjecao implements OnInit {
  readonly service = inject(ProjecaoService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly router = inject(Router);
  readonly listas = signal<ListaProjecao[]>([]);
  readonly carregando = signal(true);
  readonly ocupado = signal(false);
  readonly erro = signal('');
  readonly legadas = signal<string[]>([]);
  titulo = '';

  ngOnInit() { void this.carregar(); }

  async carregar() {
    this.carregando.set(true);
    this.erro.set('');
    try { this.listas.set(await this.service.listar()); this.legadas.set(await this.service.listarLegadas()); }
    catch { this.erro.set('Não foi possível carregar suas listas. Tente novamente.'); }
    finally { this.carregando.set(false); }
  }

  async criar() {
    if (!this.titulo.trim() || this.ocupado()) return;
    this.ocupado.set(true);
    this.erro.set('');
    const lista = this.service.novaLista(this.titulo.trim());
    try {
      const salva = await this.service.salvar(lista);
      await this.router.navigate(['/projecao'], { queryParams: { lista: salva.id } });
    } catch { this.erro.set('Não foi possível criar a lista. Tente novamente.'); }
    finally { this.ocupado.set(false); }
  }

  async migrar() {
    this.ocupado.set(true);
    this.erro.set('');
    try { await this.service.migrarLegadas(); await this.carregar(); }
    catch { this.erro.set('Não foi possível importar todas as listas antigas. Tente novamente.'); }
    finally { this.ocupado.set(false); }
  }

  async excluir(lista: ListaProjecao) {
    if (!this.service.podeExcluir(lista)) return;
    if (this.ocupado() || !await this.confirm.confirmar(`Excluir a lista “${lista.titulo}”? Ela será removida das cifras e da projeção. As músicas cadastradas serão preservadas.`)) return;
    this.ocupado.set(true);
    this.erro.set('');
    try {
      await this.service.excluir(lista.id);
      this.listas.update(listas => listas.filter(item => item.id !== lista.id));
    } catch { this.erro.set('Não foi possível excluir a lista. Tente novamente.'); }
    finally { this.ocupado.set(false); }
  }
}
