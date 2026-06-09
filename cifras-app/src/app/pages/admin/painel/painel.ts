import { Component, inject, signal, computed, OnInit, DestroyRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Lista, MusicaLista } from '../../../models/lista.model';
import { ListaService } from '../../../services/lista.service';
import { AuthService } from '../../../services/auth.service';
import { ConfigService } from '../../../services/config.service';
import { CifraService } from '../../../services/cifra.service';
import { CifraBuscaService } from '../../../services/cifra-busca.service';
import { CifraIndiceItem } from '../../../repositories/cifra.repository.interface';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ConfigItem } from '../../../models/config.model';
import { SeletorRepertorioComponent } from '../../../components/seletor-repertorio/seletor-repertorio';
import { slugify } from '../../../utils/string.utils';
import { newId } from '../../../utils/id.utils';
import { formatarDataCurta } from '../../../utils/date.utils';
import { NotificationService } from '../../../services/notification.service';
import { ThemeService } from '../../../services/theme.service';

type VistaAdmin = 'dashboard' | 'configuracoes' | 'gerenciar-cifras';

@Component({
  selector: 'app-painel',
  standalone: true,
  imports: [FormsModule, RouterLink, DragDropModule, SeletorRepertorioComponent],
  templateUrl: './painel.html',
  styleUrl: './painel.scss',
})
export class PainelComponent implements OnInit {
  @ViewChild(SeletorRepertorioComponent) seletorRef!: SeletorRepertorioComponent;
  private listaService = inject(ListaService);
  readonly auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly config = inject(ConfigService);
  private cifraService = inject(CifraService);
  private buscaService = inject(CifraBuscaService);
  private destroyRef = inject(DestroyRef);
  readonly notif = inject(NotificationService);
  readonly theme = inject(ThemeService);

  readonly CATEGORIAS_LABELS = this.config.categoriasLabels;

  vista = signal<VistaAdmin>('dashboard');
  listas = signal<Lista[]>([]);
  confirmando = signal<string | null>(null);
  carregando = signal(true);

  totalMusicasCustom = signal(0);
  readonly LIMITE_MUSICAS = 25;
  readonly podeAdicionarMusica = computed(() => this.totalMusicasCustom() < this.LIMITE_MUSICAS);

  configCatsEdit = signal<ConfigItem[]>([]);
  configPartesEdit = signal<ConfigItem[]>([]);
  salvandoConfig  = signal(false);
  reindexando     = signal(false);
  resultadoReindex = signal<{ total: number; atualizadas: number } | null>(null);

  todasCifras       = signal<CifraIndiceItem[]>([]);
  filtroCifras      = signal('');
  cifrasFiltradas   = computed(() => {
    const q = this.filtroCifras().trim();
    return q.length >= 2
      ? this.buscaService.filtrar(this.todasCifras(), q)
      : this.todasCifras();
  });
  confirmandoRemocao = signal<string | null>(null);
  removendoCifra     = signal(false);

  filtroTexto = signal('');
  listasFiltradas = computed(() => {
    const q = this.filtroTexto().toLowerCase();
    return q
      ? this.listas().filter(l => l.titulo.toLowerCase().includes(q) || (l.categoria ?? '').includes(q))
      : this.listas();
  });

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
      this.notif.mostrar(`✓ Música "${nomeCifra}" ${edicaoCifra ? 'editada' : 'cadastrada'} com sucesso!`, 4000);
    }

    // Retorno de nova-cifra com rascunho de lista → adiciona música, salva e redireciona
    const draftState = this.listaService.getDraft();
    if ((nomeCifra || restaurarRascunho) && draftState) {
      let draft = draftState.lista;

      if (nomeCifra && cifraAdicionada && !edicaoCifra) {
        const parte = draftState.parte || 'entrada';
        const novaMusica: MusicaLista = {
          id: newId('m'),
          cifraId: cifraAdicionada,
          nome: nomeCifra,
          autor: '',
          parte,
          ordem: draft.musicas.filter(m => m.parte === parte).length,
        };
        draft = { ...draft, musicas: [...draft.musicas, novaMusica] };
      }

      this.listaService.clearDraft();

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
    const uid = this.auth.user()?.uid;
    if (this.auth.isAdmin()) {
      this.listaService.getListas()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(ls => {
          this.listas.set(ls);
          this.carregando.set(false);
        });
    } else if (uid) {
      this.listaService.getTodasMinhasListas(uid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(ls => {
          this.listas.set(ls);
          this.carregando.set(false);
        });
      this.cifraService.countCifrasDoUser(uid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(count => {
          this.totalMusicasCustom.set(count);
        });
    }
  }

  sair() {
    this.auth.logout().subscribe(() => this.router.navigate(['/admin']));
  }

  // ── Seletor ───────────────────────────────────────────────────────

  abrirSeletor() { this.seletorRef.abrir(); }

  onListaSelecionada(lista: Lista) {
    this.router.navigate(['/'], { queryParams: { listaId: lista.id } });
  }

  // ── Dashboard ─────────────────────────────────────────────────────

  editarLista(lista: Lista) {
    this.router.navigate(['/'], { queryParams: { listaId: lista.id } });
  }

  confirmarExcluir(id: string) { this.confirmando.set(id); }
  cancelarExcluir() { this.confirmando.set(null); }

  excluirLista(id: string) {
    this.listaService.excluirLista(id).subscribe(() => {
      this.confirmando.set(null);
      this.listas.update(ls => ls.filter(l => l.id !== id));
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
    this.notif.mostrar('✓ Configurações salvas!');
    this.vista.set('dashboard');
  }

  reindexar() {
    this.reindexando.set(true);
    this.resultadoReindex.set(null);
    this.cifraService.reindexarIndice().subscribe({
      next: resultado => {
        this.resultadoReindex.set(resultado);
        this.reindexando.set(false);
        this.notif.mostrar(`✓ ${resultado.atualizadas} cifras reindexadas com sucesso!`, 4000);
      },
      error: () => {
        this.reindexando.set(false);
        this.notif.mostrarErro('Erro ao reindexar cifras. Tente novamente.', 4000);
      },
    });
  }

  // ── Gerenciar Cifras ─────────────────────────────────────────────

  abrirGerenciarCifras() {
    this.filtroCifras.set('');
    this.confirmandoRemocao.set(null);
    this.cifraService.getIndice()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(items => {
        this.todasCifras.set(items.slice().sort((a, b) => (a.titulo ?? '').localeCompare(b.titulo ?? '')));
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

  readonly formatarData = formatarDataCurta;

  trackById(_: number, item: { id: string }) { return item.id; }
}
