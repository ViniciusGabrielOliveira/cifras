import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Lista, MusicaLista } from '../../../models/lista.model';
import { ListaService } from '../../../services/lista.service';
import { AuthService } from '../../../services/auth.service';
import { ConfigService } from '../../../services/config.service';
import { CifraService } from '../../../services/cifra.service';
import { CifraIndiceItem } from '../../../repositories/cifra.repository.interface';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ConfigItem } from '../../../models/config.model';

type VistaAdmin = 'dashboard' | 'configuracoes' | 'gerenciar-cifras';

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

let _idCounter = Date.now();
function newId(prefix: string) { return `${prefix}-${++_idCounter}`; }

@Component({
  selector: 'app-painel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DragDropModule],
  templateUrl: './painel.html',
  styleUrl: './painel.scss',
})
export class PainelComponent implements OnInit {
  private listaService = inject(ListaService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly config = inject(ConfigService);
  private cifraService = inject(CifraService);

  get PARTES_MISSA_LABELS() { return this.config.partesLabels(); }
  get CATEGORIAS_LABELS() { return this.config.categoriasLabels(); }
  get categorias() { return this.config.categoriasIds(); }

  vista = signal<VistaAdmin>('dashboard');
  listas = signal<Lista[]>([]);
  confirmando = signal<string | null>(null);

  configCatsEdit = signal<ConfigItem[]>([]);
  configPartesEdit = signal<ConfigItem[]>([]);
  salvandoConfig = signal(false);

  todasCifras       = signal<CifraIndiceItem[]>([]);
  filtroCifras      = signal('');
  cifrasFiltradas   = computed(() => {
    const q = this.filtroCifras().toLowerCase().trim();
    return q
      ? this.todasCifras().filter(c =>
          c.titulo.toLowerCase().includes(q) ||
          c.autor.toLowerCase().includes(q) ||
          c.letra.toLowerCase().includes(q),
        )
      : this.todasCifras();
  });
  confirmandoRemocao = signal<string | null>(null);
  removendoCifra     = signal(false);

  filtroTexto = signal('');
  listasFiltradas = computed(() => {
    const q = this.filtroTexto().toLowerCase();
    return q
      ? this.listas().filter(l => l.titulo.toLowerCase().includes(q) || l.categoria.includes(q))
      : this.listas();
  });

  notificacao = signal<{ msg: string; erro?: boolean } | null>(null);

  ngOnInit() {
    this.carregarListas();

    const nomeCifra        = this.route.snapshot.queryParamMap.get('nomeCifra');
    const cifraAdicionada  = this.route.snapshot.queryParamMap.get('cifraAdicionada');
    const edicaoCifra      = this.route.snapshot.queryParamMap.get('edicaoCifra');
    const restaurarRascunho = this.route.snapshot.queryParamMap.get('restaurarRascunho');
    const retornoLista     = this.route.snapshot.queryParamMap.get('retornoLista');

    // Retorno do editor de cifra com lista de origem → redireciona para o editor da lista
    if (edicaoCifra && retornoLista) {
      this.router.navigate(['/admin/lista', retornoLista], { replaceUrl: true });
      return;
    }

    if (nomeCifra) {
      this.notificacao.set({ msg: `✓ Música "${nomeCifra}" ${edicaoCifra ? 'editada' : 'cadastrada'} com sucesso!` });
      setTimeout(() => this.notificacao.set(null), 4000);
    }

    // Retorno de nova-cifra com rascunho de lista → adiciona música, salva e redireciona
    if ((nomeCifra || restaurarRascunho) && this.listaService.listaDraft) {
      const draft = this.listaService.listaDraft as Lista;

      if (nomeCifra && cifraAdicionada && !edicaoCifra) {
        const parte = (this.listaService.parteParaAdicionarDraft as string) || 'entrada';
        const novaMusica: MusicaLista = {
          id: newId('m'),
          cifraId: cifraAdicionada,
          nome: nomeCifra,
          autor: '',
          parte,
          ordem: draft.musicas.filter(m => m.parte === parte).length,
        };
        draft.musicas.push(novaMusica);
      }

      this.listaService.listaDraft = null;
      this.listaService.vistaDraft = null;
      this.listaService.parteParaAdicionarDraft = null;

      this.listaService.salvarLista(draft).subscribe({
        next: () => this.router.navigate(['/admin/lista', draft.id], { replaceUrl: true }),
        error: () => this.router.navigate(['/admin/lista', draft.id], { replaceUrl: true }),
      });
      return;
    }

    if (nomeCifra || restaurarRascunho) {
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  carregarListas() {
    this.listaService.getListas().subscribe(ls => this.listas.set(ls));
  }

  sair() {
    this.auth.logout().subscribe(() => this.router.navigate(['/admin']));
  }

  // ── Dashboard ─────────────────────────────────────────────────────

  novaLista() {
    const agora = new Date().toISOString();
    const novaLista: Lista = {
      id: newId('lista'),
      titulo: 'Nova Lista',
      categoria: 'tempo-comum',
      musicas: [],
      criadaEm: agora,
      atualizadaEm: agora,
    };
    this.listaService.salvarLista(novaLista).subscribe({
      next: lista => this.router.navigate(['/admin/lista', lista.id]),
      error: () => {
        this.notificacao.set({ msg: 'Erro ao criar lista. Tente novamente.', erro: true });
        setTimeout(() => this.notificacao.set(null), 4000);
      },
    });
  }

  editarLista(lista: Lista) {
    this.router.navigate(['/admin/lista', lista.id]);
  }

  confirmarExcluir(id: string) { this.confirmando.set(id); }
  cancelarExcluir() { this.confirmando.set(null); }

  excluirLista(id: string) {
    this.listaService.excluirLista(id).subscribe(() => {
      this.confirmando.set(null);
      this.carregarListas();
    });
  }

  // ── Configurações ─────────────────────────────────────────────────

  abrirConfiguracoes() {
    const sortAZ = (items: ConfigItem[]) =>
      [...items].sort((a, b) => a.label.localeCompare(b.label, 'pt'))
        .map((item, i) => ({ ...item, ordem: i }));
    const sortByOrdem = (items: ConfigItem[]) =>
      [...items].sort((a, b) => a.ordem - b.ordem)
        .map((item, i) => ({ ...item, ordem: i }));
    this.configCatsEdit.set(sortAZ(JSON.parse(JSON.stringify(this.config.categorias()))));
    this.configPartesEdit.set(sortByOrdem(JSON.parse(JSON.stringify(this.config.partesMissa()))));
    this.vista.set('configuracoes');
  }

  addConfigItem(tipo: 'cat' | 'parte') {
    const list = tipo === 'cat' ? this.configCatsEdit() : this.configPartesEdit();
    const nova = { id: slugify('Nova Opção'), label: 'Nova Opção', ordem: list.length };
    if (tipo === 'cat') {
      const sorted = [...list, nova].sort((a, b) => a.label.localeCompare(b.label, 'pt'))
        .map((item, i) => ({ ...item, ordem: i }));
      this.configCatsEdit.set(sorted);
    } else {
      this.configPartesEdit.set([...list, nova].map((p, i) => ({ ...p, ordem: i })));
    }
  }

  onParteDrop(event: CdkDragDrop<ConfigItem[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const partes = [...this.configPartesEdit()];
    moveItemInArray(partes, event.previousIndex, event.currentIndex);
    this.configPartesEdit.set(partes.map((p, i) => ({ ...p, ordem: i })));
  }

  removeConfigItem(tipo: 'cat' | 'parte', idx: number) {
    const list = tipo === 'cat' ? [...this.configCatsEdit()] : [...this.configPartesEdit()];
    list.splice(idx, 1);
    list.forEach((item, i) => item.ordem = i);
    if (tipo === 'cat') this.configCatsEdit.set(list);
    else this.configPartesEdit.set(list);
  }

  updateConfigLabel(tipo: 'cat' | 'parte', idx: number, label: string) {
    const list = tipo === 'cat' ? [...this.configCatsEdit()] : [...this.configPartesEdit()];
    list[idx] = { ...list[idx], label, id: slugify(label) };
    if (tipo === 'cat') this.configCatsEdit.set(list);
    else this.configPartesEdit.set(list);
  }

  async salvarConfiguracoes() {
    this.salvandoConfig.set(true);
    await Promise.all([
      this.config.salvarCategorias(this.configCatsEdit()),
      this.config.salvarPartesMissa(this.configPartesEdit()),
    ]);
    this.salvandoConfig.set(false);
    this.notificacao.set({ msg: '✓ Configurações salvas!' });
    setTimeout(() => this.notificacao.set(null), 3000);
    this.vista.set('dashboard');
  }

  // ── Gerenciar Cifras ─────────────────────────────────────────────

  abrirGerenciarCifras() {
    this.filtroCifras.set('');
    this.confirmandoRemocao.set(null);
    this.cifraService.getIndice().subscribe(items => {
      this.todasCifras.set(items.slice().sort((a, b) => a.titulo.localeCompare(b.titulo)));
    });
    this.vista.set('gerenciar-cifras');
  }

  confirmarRemoverCifra(id: string) { this.confirmandoRemocao.set(id); }
  cancelarRemoverCifra() { this.confirmandoRemocao.set(null); }

  removerCifra(id: string) {
    this.removendoCifra.set(true);
    this.cifraService.deleteCifra(id).subscribe(() => {
      this.todasCifras.update(list => list.filter(c => c.id !== id));
      this.confirmandoRemocao.set(null);
      this.removendoCifra.set(false);
    });
  }

  editarCifraGerenciar(id: string) {
    this.router.navigate(['/admin/editar-cifra', id], {
      queryParams: { retorno: 'painel', edicaoCifra: 'true' },
    });
  }

  // ── Utils ─────────────────────────────────────────────────────────

  formatarData(iso?: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  trackById(_: number, item: { id: string }) { return item.id; }
}
