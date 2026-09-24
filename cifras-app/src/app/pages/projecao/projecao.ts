import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { MusicaSearchComponent, MusicaSelecionada } from '../../components/musica-search/musica-search';
import { ProjecaoService } from '../../services/projecao.service';
import { CifraService } from '../../services/cifra.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ListaProjecao, MusicaProjecao } from '../../models/projecao.model';
import { ProjecaoSlide } from '../../components/projecao-slide/projecao-slide';
import { LayoutProjecao, LAYOUT_PROJECAO_PADRAO, normalizarLayout } from '../../models/layout-projecao.model';
import { slidesDaCifra } from '../../core/projecao';

@Component({
  selector: 'app-projecao',
  imports: [RouterLink, FormsModule, DragDropModule, MusicaSearchComponent, ProjecaoSlide],
  templateUrl: './projecao.html',
  styleUrl: './projecao.scss',
})
export class Projecao implements OnInit, OnDestroy {
  private readonly service = inject(ProjecaoService);
  private readonly cifras = inject(CifraService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild('modal') modal!: ElementRef<HTMLDialogElement>;
  readonly musicas = signal<MusicaProjecao[]>([]);
  readonly listas = signal<ListaProjecao[]>([]);
  readonly selecionada = signal<string | null>(null);
  readonly slides = signal<string[]>([]);
  readonly slide = signal(0);
  readonly apagada = signal(false);
  readonly lateral = signal(true);
  readonly carregando = signal(false);
  readonly carregandoListas = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal('');
  readonly aviso = signal('');
  readonly alterada = signal(false);
  readonly modoModal = signal<'musicas' | 'listas'>('musicas');
  readonly atual = computed(() => this.musicas().find(item => item.id === this.selecionada()));
  readonly letra = computed(() => this.apagada() ? '' : this.slides()[this.slide()] ?? '');
  readonly layout = signal<LayoutProjecao>({ ...LAYOUT_PROJECAO_PADRAO });
  readonly editorLayout = signal(false);
  readonly layoutAlterado = signal(false);
  readonly carregandoLayout = signal(true);
  readonly salvandoLayout = signal(false);
  readonly erroLayout = signal('');
  readonly avisoLayout = signal('');
  titulo = 'Nova projeção';
  readonly listaBase = signal<ListaProjecao>(this.service.novaLista());
  readonly podeEditar = computed(() => this.service.podeEditar(this.listaBase()));
  private requisicao = 0;
  private janela: Window | null = null;
  private readonly sessao = crypto.randomUUID();

  ngOnInit() {
    void this.carregarLayout();
    const id = this.route.snapshot.queryParamMap.get('lista');
    if (id) void this.carregar(id);
  }

  async carregarLayout() {
    this.carregandoLayout.set(true);
    this.erroLayout.set('');
    try {
      const layout = await this.service.obterLayout();
      if (!this.layoutAlterado()) { this.layout.set(layout); this.enviar(); }
    } catch { this.erroLayout.set('Não foi possível carregar seu layout salvo. Você pode tentar novamente.'); }
    finally { this.carregandoLayout.set(false); }
  }

  atualizarLayout<K extends keyof LayoutProjecao>(campo: K, valor: LayoutProjecao[K]) {
    this.layout.set(normalizarLayout({ ...this.layout(), [campo]: valor }));
    this.layoutAlterado.set(true);
    this.avisoLayout.set('');
    this.enviar();
  }

  restaurarLayout() {
    this.layout.set({ ...LAYOUT_PROJECAO_PADRAO });
    this.layoutAlterado.set(true);
    this.avisoLayout.set('');
    this.enviar();
  }

  async salvarLayout() {
    if (this.salvandoLayout()) return;
    const layout = { ...this.layout() };
    this.salvandoLayout.set(true);
    this.erroLayout.set('');
    try {
      await this.service.salvarLayout(layout);
      if (JSON.stringify(layout) === JSON.stringify(this.layout())) this.layoutAlterado.set(false);
      this.avisoLayout.set('Layout padrão salvo para suas projeções.');
    } catch { this.erroLayout.set('Não foi possível salvar o layout. Tente novamente; os ajustes continuam na prévia.'); }
    finally { this.salvandoLayout.set(false); }
  }

  async carregar(id: string) {
    this.carregando.set(true);
    this.erro.set('');
    try {
      const lista = await this.service.obter(id);
      if (!lista) { this.erro.set('Lista não encontrada.'); return; }
      this.aplicarLista(lista);
      if (lista.id !== id) void this.router.navigate([], { relativeTo: this.route, queryParams: { lista: lista.id }, replaceUrl: true });
    } catch { this.erro.set('Não foi possível abrir a lista. Tente selecioná-la novamente.'); }
    finally { this.carregando.set(false); }
  }

  private aplicarLista(lista: ListaProjecao) {
    ++this.requisicao;
    this.listaBase.set(lista);
    this.titulo = lista.titulo;
    this.musicas.set([...lista.musicas]);
    this.selecionada.set(null);
    this.slides.set([]);
    this.slide.set(0);
    this.alterada.set(false);
    this.carregando.set(false);
    this.aviso.set('');
    this.enviar();
  }

  async escolherLista(lista: ListaProjecao) {
    this.modal.nativeElement.close();
    if (this.alterada() && !await this.confirm.confirmar('Trocar de lista e descartar as alterações não salvas?')) {
      this.modal.nativeElement.showModal();
      return;
    }
    this.aplicarLista(lista);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { lista: lista.id }, replaceUrl: true });
  }

  async abrirModal(modo: 'musicas' | 'listas') {
    if (modo === 'musicas' && !this.podeEditar()) return;
    this.modoModal.set(modo);
    this.erro.set('');
    this.modal.nativeElement.showModal();
    if (modo === 'listas') {
      this.carregandoListas.set(true);
      try { this.listas.set(await this.service.listar()); }
      catch { this.erro.set('Não foi possível carregar as listas. Feche e tente novamente.'); }
      finally { this.carregandoListas.set(false); }
    }
  }

  adicionar(musica: MusicaSelecionada) {
    if (!this.podeEditar()) return;
    if (this.musicas().length >= 200) { this.erro.set('Cada lista pode ter até 200 músicas.'); return; }
    this.musicas.update(items => [...items, { id: crypto.randomUUID(), cifraId: musica.cifraId, nome: musica.nome, autor: musica.autor, parte: this.listaBase().partes?.[0]?.id ?? 'entrada', ordem: items.length }]);
    this.alterada.set(true);
    this.aviso.set(`“${musica.nome}” adicionada à lista.`);
  }

  remover(id: string) {
    if (!this.podeEditar()) return;
    this.musicas.update(items => items.filter(item => item.id !== id));
    if (this.selecionada() === id) {
      ++this.requisicao;
      this.selecionada.set(null);
      this.slides.set([]);
      this.carregando.set(false);
      this.enviar();
    }
    this.alterada.set(true);
  }

  reordenar(event: CdkDragDrop<MusicaProjecao[]>) { this.mover(event.previousIndex, event.currentIndex); }
  mover(de: number, para: number) {
    if (!this.podeEditar()) return;
    if (para < 0 || para >= this.musicas().length || de === para) return;
    const items = [...this.musicas()];
    moveItemInArray(items, de, para);
    this.musicas.set(items);
    this.alterada.set(true);
  }

  async selecionar(musica: MusicaProjecao) {
    const req = ++this.requisicao;
    this.selecionada.set(musica.id);
    this.slides.set([]);
    this.slide.set(0);
    this.carregando.set(true);
    this.erro.set('');
    this.enviar();
    try {
      const cifra = (this.listaBase().id
        ? await firstValueFrom(this.cifras.getCifraEmLista(this.listaBase().id, musica.cifraId))
        : undefined) ?? await firstValueFrom(this.cifras.getCifra(musica.cifraId));
      if (req !== this.requisicao) return;
      if (!cifra) { this.erro.set('Música indisponível ou removida do acervo.'); return; }
      this.slides.set(slidesDaCifra(cifra));
      if (!this.slides().length) this.erro.set('Esta música não tem letra disponível para projeção.');
      this.enviar();
    } catch { if (req === this.requisicao) this.erro.set('Não foi possível carregar a música. Selecione-a para tentar novamente.'); }
    finally { if (req === this.requisicao) this.carregando.set(false); }
  }

  irSlide(indice: number) {
    if (indice < 0 || indice >= this.slides().length) return;
    this.slide.set(indice);
    this.enviar();
  }

  alternarApagada() { this.apagada.update(valor => !valor); this.enviar(); }

  abrirTelao() {
    const caminho = this.router.serializeUrl(this.router.createUrlTree(['/projecao/tela'], { queryParams: { sessao: this.sessao } }));
    const url = new URL(caminho.replace(/^\//, ''), document.baseURI);
    this.janela = window.open(url.href, `telao-${this.sessao}`, 'popup,width=1280,height=720');
    if (!this.janela) this.erro.set('Permita pop-ups para abrir a janela do telão.');
    else this.janela.focus();
  }

  private enviar() {
    if (this.janela && !this.janela.closed) {
      this.janela.postMessage({ tipo: 'projecao-slide', sessao: this.sessao, letra: this.letra(), layout: this.layout() }, window.location.origin);
    }
  }

  @HostListener('window:message', ['$event'])
  receber(event: MessageEvent) {
    if (event.origin === window.location.origin && event.source === this.janela && event.data?.sessao === this.sessao && event.data?.tipo === 'projecao-pronta') this.enviar();
  }

  @HostListener('window:keydown', ['$event'])
  teclado(event: KeyboardEvent) {
    if (this.modal?.nativeElement.open || this.confirm.estado() || (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select, button, a') || event.target.isContentEditable))) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.irSlide(this.slide() + (event.key === 'ArrowRight' ? 1 : -1));
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  antesDeSair(event: BeforeUnloadEvent) {
    if (this.alterada() || this.layoutAlterado()) { event.preventDefault(); event.returnValue = ''; }
  }

  podeSair(): boolean | Promise<boolean> {
    return (!this.alterada() && !this.layoutAlterado()) || this.confirm.confirmar('Sair sem salvar as alterações da lista ou do layout de projeção?');
  }

  async salvar() {
    if (!this.titulo.trim() || this.salvando() || !this.podeEditar()) return;
    this.salvando.set(true);
    this.erro.set('');
    const base = this.listaBase();
    const snapshotMusicas = JSON.stringify(this.musicas());
    const lista: ListaProjecao = {
      ...base, titulo: this.titulo.trim(),
      musicas: this.musicas().map((musica, ordem) => ({ ...musica, ordem })),
    };
    try {
      const salva = await this.service.salvar(lista);
      const anteriores = new Set(base.musicas.map(m => m.cifraId));
      const atuais = new Set(salva.musicas.map(m => m.cifraId));
      await Promise.all([
        ...[...atuais].filter(id => !anteriores.has(id)).map(id => firstValueFrom(this.cifras.atualizarListasIds(id, salva.id, 'add'))),
        ...[...anteriores].filter(id => !atuais.has(id)).map(id => firstValueFrom(this.cifras.atualizarListasIds(id, salva.id, 'remove'))),
      ]);
      if (this.listaBase() === base) {
        this.listaBase.set(salva);
        if (this.titulo.trim() === lista.titulo && JSON.stringify(this.musicas()) === snapshotMusicas) this.alterada.set(false);
        void this.router.navigate([], { relativeTo: this.route, queryParams: { lista: salva.id }, replaceUrl: true });
      }
      this.aviso.set('Lista salva.');
    } catch { this.erro.set('Não foi possível salvar a lista. Suas alterações continuam nesta tela.'); }
    finally { this.salvando.set(false); }
  }

  ngOnDestroy() {
    ++this.requisicao;
    if (this.janela && !this.janela.closed) this.janela.postMessage({ tipo: 'projecao-slide', sessao: this.sessao, letra: '' }, window.location.origin);
  }
}
