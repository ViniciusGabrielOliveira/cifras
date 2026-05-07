import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  Lista, MusicaLista, PartesMissa, CategoriaLiturgica,
  PARTES_MISSA_LABELS, PARTES_MISSA_ORDER, CATEGORIAS_LABELS,
} from '../../../models/lista.model';
import { ListaService } from '../../../services/lista.service';
import { AuthService } from '../../../services/auth.service';
import { MusicaSearchComponent, MusicaSelecionada } from '../../../components/musica-search/musica-search';

type VistaAdmin = 'dashboard' | 'nova-lista' | 'editar-lista';

let _idCounter = Date.now();
function newId(prefix: string) { return `${prefix}-${++_idCounter}`; }

@Component({
  selector: 'app-painel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MusicaSearchComponent],
  templateUrl: './painel.html',
  styleUrl: './painel.scss',
})
export class PainelComponent implements OnInit {
  private listaService = inject(ListaService);
  private auth         = inject(AuthService);
  private router       = inject(Router);

  // ── Labels para template ─────────────────────────────────────────
  readonly PARTES_MISSA_LABELS = PARTES_MISSA_LABELS;
  readonly PARTES_MISSA_ORDER  = PARTES_MISSA_ORDER;
  readonly CATEGORIAS_LABELS   = CATEGORIAS_LABELS;
  readonly categorias: CategoriaLiturgica[] = [
    'tempo-comum', 'advento', 'quaresma', 'pascoa', 'festas-liturgicas', 'sem-categoria',
  ];

  // ── Estado ───────────────────────────────────────────────────────
  vista       = signal<VistaAdmin>('dashboard');
  listas      = signal<Lista[]>([]);
  listaEdit   = signal<Lista | null>(null);
  salvando    = signal(false);
  confirmando = signal<string | null>(null);

  // ── Busca de música ───────────────────────────────────────────────
  /** Parte pré-selecionada ao abrir o modal de adição de música */
  parteParaAdicionar = signal<PartesMissa>('entrada');
  modalBuscaAberto   = signal(false);

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

  private route = inject(ActivatedRoute);

  ngOnInit() {
    if (!this.auth.isLogado()) {
      this.router.navigate(['/admin']);
      return;
    }
    this.carregarListas();

    // Detecta retorno da tela de nova cifra
    const nomeCifra = this.route.snapshot.queryParamMap.get('nomeCifra');
    const cifraAdicionada = this.route.snapshot.queryParamMap.get('cifraAdicionada');
    const edicaoCifra = this.route.snapshot.queryParamMap.get('edicaoCifra');
    
    if (nomeCifra) {
      this.notificacao.set(`✓ Música "${nomeCifra}" ${edicaoCifra ? 'editada' : 'cadastrada'} com sucesso!`);
      setTimeout(() => this.notificacao.set(null), 4000);

      // Se havia um rascunho salvo, restaura a lista
      if (this.listaService.listaDraft && cifraAdicionada) {
        const draft = this.listaService.listaDraft;
        
        if (!edicaoCifra) {
          const parte = (this.listaService.parteParaAdicionarDraft as PartesMissa) || 'entrada';
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
        
        // Restaura a view
        this.listaEdit.set(draft);
        if (this.listaService.vistaDraft) {
          this.vista.set(this.listaService.vistaDraft as VistaAdmin);
        }
        
        // Limpa o rascunho do service
        this.listaService.listaDraft = null;
        this.listaService.vistaDraft = null;
        this.listaService.parteParaAdicionarDraft = null;
      }

      // Remove os query params sem recarregar
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  carregarListas() {
    this.listaService.getListas().subscribe(ls => this.listas.set(ls));
  }

  // ── Auth ─────────────────────────────────────────────────────────
  sair() {
    this.auth.logout();
    this.router.navigate(['/admin']);
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
  cancelarExcluir()            { this.confirmando.set(null); }

  excluirLista(id: string) {
    this.listaService.excluirLista(id).subscribe(() => {
      this.confirmando.set(null);
      this.carregarListas();
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
    const val = (event.target as HTMLSelectElement).value as CategoriaLiturgica;
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

  abrirModalBusca(parte: PartesMissa) {
    this.parteParaAdicionar.set(parte);
    this.modalBuscaAberto.set(true);
  }

  fecharModalBusca() {
    this.modalBuscaAberto.set(false);
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

  onMusicaSelecionada(selecionada: MusicaSelecionada) {
    const lista = this.listaEdit();
    if (!lista) return;

    const novaMusica: MusicaLista = {
      id:      newId('m'),
      cifraId: selecionada.cifraId,
      nome:    selecionada.nome,
      autor:   selecionada.autor,
      trecho:  selecionada.trecho,
      parte:   this.parteParaAdicionar(),
      ordem:   lista.musicas.filter(m => m.parte === this.parteParaAdicionar()).length,
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

  editarCifra(musica: MusicaLista) {
    const lista = this.listaEdit();
    if (lista) {
      this.listaService.listaDraft = JSON.parse(JSON.stringify(lista));
      this.listaService.vistaDraft = this.vista() as any;
    }
    this.router.navigate(['/editor', musica.cifraId], { queryParams: { retorno: 'painel', edicaoCifra: 'true' } });
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

  musicasDaParte(parte: PartesMissa): MusicaLista[] {
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
