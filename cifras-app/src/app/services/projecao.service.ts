import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ListaService } from './lista.service';
import { ProjecaoRepository } from '../repositories/projecao.repository';
import { ListaProjecao } from '../models/projecao.model';
import { LayoutProjecao } from '../models/layout-projecao.model';

@Injectable({ providedIn: 'root' })
export class ProjecaoService {
  private readonly auth = inject(AuthService);
  private readonly repo = inject(ProjecaoRepository);
  private readonly listas = inject(ListaService);

  private uid(): string {
    const uid = this.auth.user()?.uid;
    if (!uid) throw new Error('Entre para acessar seus repertórios.');
    return uid;
  }

  novaLista(titulo = 'Nova projeção'): ListaProjecao {
    const agora = new Date().toISOString();
    return {
      id: '', titulo, musicas: [], criadaEm: agora, atualizadaEm: agora,
      tipo: 'privada', donoUid: this.uid(), donoNome: this.auth.displayName(),
      participantes: [], participantesUids: [], partes: [{ id: 'projecao', label: 'Repertório' }],
    };
  }

  podeEditar(lista: ListaProjecao): boolean {
    return this.auth.hasRole('editor') || (lista.tipo === 'privada' && (
      lista.donoUid === this.uid() || lista.participantes?.some(p => p.uid === this.uid() && p.role === 'editor') === true
    ));
  }

  podeExcluir(lista: ListaProjecao): boolean {
    return this.auth.isAdmin() || (lista.tipo === 'privada' && lista.donoUid === this.uid());
  }

  async listar(): Promise<ListaProjecao[]> {
    const listas = await firstValueFrom(this.listas.getTodasMinhasListas(this.uid()));
    return [...new Map(listas.map(lista => [lista.id, lista])).values()]
      .sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
  }
  listarLegadas() { return this.repo.listarLegadas(this.uid()); }
  async migrarLegadas(): Promise<void> {
    const uid = this.uid();
    for (const id of await this.repo.listarLegadas(uid)) {
      await this.repo.migrarLegada(uid, id, this.auth.displayName());
    }
  }
  obterLayout() { return this.repo.obterLayout(this.uid()); }
  salvarLayout(layout: LayoutProjecao) { return this.repo.salvarLayout(this.uid(), layout); }
  async obter(id: string) {
    const lista = await firstValueFrom(this.listas.getLista(id));
    if (lista) return lista;
    const migrada = await this.repo.migrarLegada(this.uid(), id, this.auth.displayName());
    return migrada ? firstValueFrom(this.listas.getLista(migrada)) : undefined;
  }
  salvar(lista: ListaProjecao) {
    if (!this.podeEditar(lista)) throw new Error('Sem permissão para editar este repertório.');
    return firstValueFrom(this.listas.salvarLista(lista));
  }
  excluir(id: string) { return firstValueFrom(this.listas.excluirLista(id)); }
}
