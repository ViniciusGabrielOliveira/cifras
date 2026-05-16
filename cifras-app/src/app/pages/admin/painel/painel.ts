import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Lista, MusicaLista } from '../../../models/lista.model';
import { ListaService } from '../../../services/lista.service';
import { AuthService } from '../../../services/auth.service';
import { ConfigService } from '../../../services/config.service';
import { CifraClubImportService, CifraClubSugestao } from '../../../services/cifraclub-import.service';
import { CifraService } from '../../../services/cifra.service';
import { CifraIndiceItem } from '../../../repositories/cifra.repository.interface';
import { MusicaSelecionada } from '../../../components/musica-search/musica-search';
import { PainelModalBuscaComponent } from './painel-modal-busca';

type VistaAdmin = 'dashboard' | 'nova-lista' | 'editar-lista' | 'configuracoes' | 'gerenciar-cifras';

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
  imports: [CommonModule, FormsModule, RouterLink, PainelModalBuscaComponent],
  templateUrl: './painel.html',
  styleUrl: './painel.scss',
})
export class PainelComponent implements OnInit {
  private listaService = inject(ListaService);
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly config = inject(ConfigService);

  // ── Labels para template ─────────────────────────────────────────
  get PARTES_MISSA_LABELS() { return this.config.partesLabels(); }
  get PARTES_MISSA_ORDER() { return this.config.partesIds(); }
  get CATEGORIAS_LABELS() { return this.config.categoriasLabels(); }
  get categorias() { return this.config.categoriasIds(); }

  // ── Estado ───────────────────────────────────────────────────────
  vista = signal<VistaAdmin>('dashboard');
  listas = signal<Lista[]>([]);
  listaEdit = signal<Lista | null>(null);
  salvando = signal(false);
  confirmando = signal<string | null>(null);

  // ── Configurações Edit ───────────────────────────────────────────
  configCatsEdit = signal<import('../../../models/config.model').ConfigItem[]>([]);
  configPartesEdit = signal<import('../../../models/config.model').ConfigItem[]>([]);
  salvandoConfig = signal(false);

  private cifraClubService = inject(CifraClubImportService);
  private cifraService = inject(CifraService);

  // ── Gerenciar Cifras ──────────────────────────────────────────────
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

  // ── Busca de música ───────────────────────────────────────────────
  parteParaAdicionar  = signal('entrada');
  modalBuscaAberto    = signal(false);
  importandoCifraClub = signal(false);
  erroImportCC        = signal<string | null>(null);

  // Filtro no dashboard
  filtroTexto = signal('');
  listasFiltradas = computed(() => {
    const q = this.filtroTexto().toLowerCase();
    return q
      ? this.listas().filter(l => l.titulo.toLowerCase().includes(q) || l.categoria.includes(q))
      : this.listas();
  });

  // ── Notificação pós-cadastro ─────────────────────────────────────
  notificacao = signal<string | null>(null);

  cifrasExistentes = signal<Set<string>>(new Set());

  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.carregarListas();
    this.cifraService.getIndice().subscribe(items => {
      this.cifrasExistentes.set(new Set(items.map(i => i.id)));
    });

    // Detecta retorno da tela de nova cifra ou do editor
    const nomeCifra        = this.route.snapshot.queryParamMap.get('nomeCifra');
    const cifraAdicionada  = this.route.snapshot.queryParamMap.get('cifraAdicionada');
    const edicaoCifra      = this.route.snapshot.queryParamMap.get('edicaoCifra');
    const restaurarRascunho = this.route.snapshot.queryParamMap.get('restaurarRascunho');

    if (nomeCifra) {
      this.notificacao.set(`✓ Música "${nomeCifra}" ${edicaoCifra ? 'editada' : 'cadastrada'} com sucesso!`);
      setTimeout(() => this.notificacao.set(null), 4000);
    }

    if ((nomeCifra || restaurarRascunho) && this.listaService.listaDraft) {
      const draft = this.listaService.listaDraft;

      // Só adiciona a música nova se veio de um cadastro (não de um cancelamento ou edição)
      if (nomeCifra && cifraAdicionada && !edicaoCifra) {
        const parte = (this.listaService.parteParaAdicionarDraft as string) || 'entrada';
        const novaMusica: MusicaLista = {
          id: newId('m'),
          cifraId: cifraAdicionada,
          nome: nomeCifra,
          autor: '',
          parte: parte,
          ordem: draft.musicas.filter(m => m.parte === parte).length,
        };
        draft.musicas.push(novaMusica);
      }

      this.listaEdit.set(draft);
      if (this.listaService.vistaDraft) {
        this.vista.set(this.listaService.vistaDraft as VistaAdmin);
      }

      this.listaService.listaDraft = null;
      this.listaService.vistaDraft = null;
      this.listaService.parteParaAdicionarDraft = null;
    }

    if (nomeCifra || restaurarRascunho) {
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  carregarListas() {
    this.listaService.getListas().subscribe(ls => this.listas.set(ls));
  }

  // ── Auth ─────────────────────────────────────────────────────────
  sair() {
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/admin']);
    });
  }

  // ── Dashboard ─────────────────────────────────────────────────────
  novaLista() {
    const hoje = new Date().toISOString().split('T')[0];
    this.listaEdit.set({
      id: newId('lista'),
      titulo: '',
      data: hoje,
      categoria: 'tempo-comum',
      musicas: [],
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    });
    this.vista.set('nova-lista');
  }

  editarLista(lista: Lista) {
    this.listaEdit.set(JSON.parse(JSON.stringify(lista)));
    this.vista.set('editar-lista');
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
    const sortAZ = (items: import('../../../models/config.model').ConfigItem[]) =>
      [...items].sort((a, b) => a.label.localeCompare(b.label, 'pt'))
        .map((item, i) => ({ ...item, ordem: i }));
    this.configCatsEdit.set(sortAZ(JSON.parse(JSON.stringify(this.config.categorias()))));
    this.configPartesEdit.set(sortAZ(JSON.parse(JSON.stringify(this.config.partesMissa()))));
    this.vista.set('configuracoes');
  }

  addConfigItem(tipo: 'cat' | 'parte') {
    const list = tipo === 'cat' ? this.configCatsEdit() : this.configPartesEdit();
    const nova = { id: slugify('Nova Opção'), label: 'Nova Opção', ordem: list.length };
    const sorted = [...list, nova].sort((a, b) => a.label.localeCompare(b.label, 'pt'))
      .map((item, i) => ({ ...item, ordem: i }));
    if (tipo === 'cat') this.configCatsEdit.set(sorted);
    else this.configPartesEdit.set(sorted);
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
    this.notificacao.set('✓ Configurações salvas!');
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

  // ── Editor ───────────────────────────────────────────────────────

  onInputCampo(campo: keyof Lista, event: Event) {
    this.definirCampo(campo, (event.target as HTMLInputElement).value as any);
  }

  onDataChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.definirCampo('data', val || undefined);
  }

  onCategoriaChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.definirCampo('categoria', val);
  }

  onMusicaInput(musicaId: string, campo: keyof MusicaLista, event: Event) {
    this.atualizarMusica(musicaId, campo, (event.target as HTMLInputElement).value);
  }

  onMusicaParteChange(musicaId: string, event: Event) {
    this.atualizarMusica(musicaId, 'parte', (event.target as HTMLSelectElement).value);
  }

  definirCampo<K extends keyof Lista>(campo: K, valor: Lista[K]) {
    const atual = this.listaEdit();
    if (!atual) return;
    this.listaEdit.set({ ...atual, [campo]: valor });
  }

  salvarLista() {
    const lista = this.listaEdit();
    if (!lista || !lista.titulo.trim()) return;
    this.salvando.set(true);
    this.listaService.salvarLista(lista).subscribe(() => {
      this.salvando.set(false);
      this.carregarListas();
      this.vista.set('dashboard');
    });
  }

  cancelarEdicao() { this.vista.set('dashboard'); }

  // ── Modal de Busca ────────────────────────────────────────────────

  abrirModalBusca(parte: string) {
    this.parteParaAdicionar.set(parte);
    this.modalBuscaAberto.set(true);
  }

  fecharModalBusca() {
    this.modalBuscaAberto.set(false);
    this.erroImportCC.set(null);
  }

  onCadastrarNova(nomeBuscado: string) {
    this.fecharModalBusca();

    // Salva o rascunho da lista atual para não perder após cadastrar a cifra
    const lista = this.listaEdit();
    if (lista) {
      this.listaService.listaDraft = JSON.parse(JSON.stringify(lista));
      this.listaService.vistaDraft = this.vista() as any;
      this.listaService.parteParaAdicionarDraft = this.parteParaAdicionar();
    }

    this.router.navigate(['/admin/nova-cifra'], {
      queryParams: { nome: nomeBuscado },
    });
  }

  async onCifraClubSelecionada(sugestao: CifraClubSugestao) {
    this.erroImportCC.set(null);
    this.importandoCifraClub.set(true);
    try {
      const result = await this.cifraClubService.importarMusica(sugestao);

      // Guarda o resultado para nova-cifra consumir ao abrir
      this.cifraClubService.pendingImport = result;

      // Salva o rascunho da lista igual ao onCadastrarNova
      const lista = this.listaEdit();
      if (lista) {
        this.listaService.listaDraft = JSON.parse(JSON.stringify(lista));
        this.listaService.vistaDraft = this.vista() as any;
        this.listaService.parteParaAdicionarDraft = this.parteParaAdicionar();
      }

      this.fecharModalBusca();
      this.router.navigate(['/admin/nova-cifra']);
    } catch {
      this.erroImportCC.set('Não foi possível importar do Cifra Club. Tente novamente.');
      this.importandoCifraClub.set(false);
    }
  }

  onMusicaSelecionada(selecionada: MusicaSelecionada) {
    const lista = this.listaEdit();
    if (!lista) return;

    const novaMusica: MusicaLista = {
      id: newId('m'),
      cifraId: selecionada.cifraId,
      nome: selecionada.nome,
      autor: selecionada.autor,
      trecho: selecionada.trecho,
      parte: this.parteParaAdicionar(),
      ordem: lista.musicas.filter(m => m.parte === this.parteParaAdicionar()).length,
    };

    this.listaEdit.set({ ...lista, musicas: [...lista.musicas, novaMusica] });
    this.fecharModalBusca();
  }

  // ── Músicas ───────────────────────────────────────────────────────

  removerMusica(musicaId: string) {
    const lista = this.listaEdit();
    if (!lista) return;
    this.listaEdit.set({
      ...lista,
      musicas: lista.musicas
        .filter(m => m.id !== musicaId)
        .map((m, i) => ({ ...m, ordem: i })),
    });
  }

  atualizarMusica(musicaId: string, campo: keyof MusicaLista, valor: string | number) {
    const lista = this.listaEdit();
    if (!lista) return;
    this.listaEdit.set({
      ...lista,
      musicas: lista.musicas.map(m =>
        m.id === musicaId ? { ...m, [campo]: valor } : m,
      ),
    });
  }

  cifraExiste(cifraId: string): boolean {
    return this.cifrasExistentes().has(cifraId);
  }

  editarCifra(musica: MusicaLista) {
    const lista = this.listaEdit();
    if (lista) {
      this.listaService.listaDraft = JSON.parse(JSON.stringify(lista));
      this.listaService.vistaDraft = this.vista() as any;
    }
    this.router.navigate(['/admin/editar-cifra', musica.cifraId], { queryParams: { retorno: 'painel', edicaoCifra: 'true' } });
  }

  moverMusica(musicaId: string, dir: -1 | 1) {
    const lista = this.listaEdit();
    if (!lista) return;
    const musicas = [...lista.musicas];
    const idx = musicas.findIndex(m => m.id === musicaId);
    const novoIdx = idx + dir;
    if (novoIdx < 0 || novoIdx >= musicas.length) return;
    [musicas[idx], musicas[novoIdx]] = [musicas[novoIdx], musicas[idx]];
    this.listaEdit.set({ ...lista, musicas: musicas.map((m, i) => ({ ...m, ordem: i })) });
  }

  musicasDaParte(parte: string): MusicaLista[] {
    return (this.listaEdit()?.musicas ?? [])
      .filter(m => m.parte === parte)
      .sort((a, b) => a.ordem - b.ordem);
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
