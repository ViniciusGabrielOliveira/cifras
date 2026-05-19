import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Cifra, Secao, LinhaCifra, TipoSecao } from '../../../models/cifra.model';
import { CifraService } from '../../../services/cifra.service';
import { ConfigService } from '../../../services/config.service';
import { AuthService } from '../../../services/auth.service';
import { LinhaEditorComponent } from '../../../components/linha-editor/linha-editor';
import { AppSelectComponent } from '../../../components/app-select/app-select';
import { CifraClubImportService } from '../../../services/cifraclub-import.service';
import { AcordesService } from '../../../services/acordes.service';
import { parseCifraTexto, slugify, TONS } from '../../../core/cifra-parser';

const TIPOS: TipoSecao[] = ['intro', 'verso', 'pre-refrao', 'refrao', 'ponte', 'outro', 'solo', 'tab'];

@Component({
  selector: 'app-nova-cifra',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, LinhaEditorComponent, AppSelectComponent],
  templateUrl: './nova-cifra.html',
  styleUrl: './nova-cifra.scss',
})
export class NovaCifraComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private cifraService = inject(CifraService);
  private cifraClub = inject(CifraClubImportService);
  private acordesService = inject(AcordesService);
  private config = inject(ConfigService);
  private auth = inject(AuthService);

  readonly userMode = computed(() => !!this.route.snapshot.data['userMode']);

  readonly tiposSecao = TIPOS;
  readonly tons = TONS;
  readonly categorias = this.config.categorias;
  readonly partesMissa = this.config.partesMissa;

  readonly tonsOptions = TONS;
  readonly tiposSecaoOptions = TIPOS;
  readonly instrumentoOptions = [
    { value: 'violao', label: 'Violão' },
    { value: 'guitarra', label: 'Guitarra' },
    { value: 'cavaco', label: 'Cavaquinho' },
    { value: 'ukulele', label: 'Ukulele' },
  ];
  readonly dificuldadeOptions = [
    { value: 'iniciante', label: 'Iniciante' },
    { value: 'basico', label: 'Básico' },
    { value: 'intermediario', label: 'Intermediário' },
    { value: 'avancado', label: 'Avançado' },
  ];

  cifra = signal<Cifra>({
    id:          '',
    titulo:      '',
    artista:     '',
    tom:         'C',
    instrumento: 'violao',
    dificuldade: 'basico',
    composicao:  '',
    categorias:  [],
    partesMissa: [],
    secoes: [{
      tipo:  'verso',
      label: 'Verso 1',
      linhas: [{ letra: '', acordes: [] }],
    }],
  });

  saving  = signal(false);
  saved   = signal(false);
  colando = signal(false);

  // Validação
  erroTitulo = signal(false);

  ngOnInit() {
    // Resultado de import vindo do modal do painel — tem prioridade sobre ?nome=
    const pending = this.cifraClub.pendingImport;
    if (pending) {
      this.cifraClub.pendingImport = null;
      const secoes = parseCifraTexto(pending.lyricsWithChords);
      const tom = TONS.includes(pending.tom) ? pending.tom : 'C';
      this.cifra.set({
        id:          slugify(pending.title || ''),
        titulo:      pending.title  || '',
        artista:     pending.artist || '',
        tom,
        instrumento: 'violao',
        dificuldade: 'basico',
        composicao:  '',
        secoes,
      });
      return;
    }

    const nome = this.route.snapshot.queryParamMap.get('nome') ?? '';
    if (nome) {
      this.cifra.update(c => ({
        ...c,
        titulo: nome,
        id:     slugify(nome),
      }));
    }
  }

  // ── Metadados ─────────────────────────────────────────────────────

  updateMeta(field: keyof Cifra, value: string) {
    this.cifra.update(c => {
      const updated: Cifra = { ...c, [field]: value };
      if (field === 'titulo') {
        updated.id = slugify(value);
      }
      return updated;
    });
    if (field === 'titulo') this.erroTitulo.set(false);
  }

  toggleCategoria(id: string) {
    this.cifra.update(c => {
      const cats = c.categorias ?? [];
      return { ...c, categorias: cats.includes(id) ? cats.filter(x => x !== id) : [...cats, id] };
    });
  }

  toggleParte(id: string) {
    this.cifra.update(c => {
      const partes = c.partesMissa ?? [];
      return { ...c, partesMissa: partes.includes(id) ? partes.filter(x => x !== id) : [...partes, id] };
    });
  }

  // ── Seções ────────────────────────────────────────────────────────

  addSecao() {
    const nova: Secao = { tipo: 'verso', label: 'Nova Seção', linhas: [{ letra: '', acordes: [] }] };
    this.cifra.update(c => ({ ...c, secoes: [...c.secoes, nova] }));
  }

  removeSecao(idx: number) {
    this.cifra.update(c => ({ ...c, secoes: c.secoes.filter((_: Secao, i: number) => i !== idx) }));
  }

  updateSecaoLabel(idx: number, label: string) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      secoes[idx] = { ...secoes[idx], label };
      return { ...c, secoes };
    });
  }

  onSecaoTipoChange(idx: number, value: string) {
    this.updateSecaoTipo(idx, value as TipoSecao);
  }

  updateSecaoTipo(idx: number, tipo: TipoSecao) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      const secao = secoes[idx];
      if (tipo === 'tab') {
        // Converte linhas existentes em texto bruto
        const tabText = secao.linhas.map(l => l.letra).join('\n');
        secoes[idx] = { ...secao, tipo, linhas: [], tabText };
      } else if (secao.tipo === 'tab') {
        // Converte o texto bruto de volta para linhas simples
        const linhas = (secao.tabText ?? '').split('\n').map(l => ({ letra: l, acordes: [] }));
        secoes[idx] = { ...secao, tipo, linhas, tabText: undefined };
      } else {
        secoes[idx] = { ...secao, tipo };
      }
      return { ...c, secoes };
    });
  }

  updateTabText(idx: number, tabText: string) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      secoes[idx] = { ...secoes[idx], tabText };
      return { ...c, secoes };
    });
  }

  // ── Linhas ────────────────────────────────────────────────────────

  addLinha(secaoIdx: number) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      secoes[secaoIdx] = {
        ...secoes[secaoIdx],
        linhas: [...secoes[secaoIdx].linhas, { letra: '', acordes: [] }],
      };
      return { ...c, secoes };
    });
  }

  removeLinha(secaoIdx: number, linhaIdx: number) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      const linhas = secoes[secaoIdx].linhas.filter((_: LinhaCifra, i: number) => i !== linhaIdx);
      secoes[secaoIdx] = { ...secoes[secaoIdx], linhas };
      return { ...c, secoes };
    });
  }

  updateLinha(secaoIdx: number, linhaIdx: number, linha: LinhaCifra) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      const linhas = [...secoes[secaoIdx].linhas];
      linhas[linhaIdx] = linha;
      secoes[secaoIdx] = { ...secoes[secaoIdx], linhas };
      return { ...c, secoes };
    });
  }

  // ── Salvar ────────────────────────────────────────────────────────

  salvar() {
    const cifraBase = this.cifra();
    if (!cifraBase.titulo.trim()) {
      this.erroTitulo.set(true);
      return;
    }

    const cifra: Cifra = (this.userMode() && !this.auth.hasRole('admin'))
      ? { ...cifraBase, status: 'privada', donoUid: this.auth.user()?.uid }
      : cifraBase;

    this.saving.set(true);
    this.cifraService.salvarCifra(cifra).subscribe(() => {
      this.acordesService.syncAcordes(cifra);
      this.saving.set(false);
      this.saved.set(true);
      if (this.userMode()) {
        const retornoLista = this.route.snapshot.queryParamMap.get('retornoLista');
        const parte = this.route.snapshot.queryParamMap.get('parte') ?? 'entrada';
        if (retornoLista) {
          setTimeout(() => this.router.navigate(['/minha-area/lista', retornoLista], {
            queryParams: { cifraAdicionada: cifra.id, nomeCifra: cifra.titulo, parte },
          }), 800);
        } else {
          setTimeout(() => this.router.navigate(['/minha-area']), 800);
        }
      } else {
        setTimeout(() => this.router.navigate(['/admin/painel'], {
          queryParams: { cifraAdicionada: cifra.id, nomeCifra: cifra.titulo },
        }), 800);
      }
    });
  }

  async colarMusica() {
    try {
      this.colando.set(true);
      const texto = await navigator.clipboard.readText();
      const secoes = parseCifraTexto(texto);
      this.cifra.update(c => ({ ...c, secoes }));
    } catch { /* permissão negada ou clipboard vazio */ }
    finally { this.colando.set(false); }
  }

  cancelar() {
    if (confirm('Descartar a nova música?')) {
      if (this.userMode()) {
        const retornoLista = this.route.snapshot.queryParamMap.get('retornoLista');
        if (retornoLista) {
          this.router.navigate(['/minha-area/lista', retornoLista]);
        } else {
          this.router.navigate(['/minha-area']);
        }
      } else {
        this.router.navigate(['/admin/painel'], {
          queryParams: { restaurarRascunho: 'true' },
        });
      }
    }
  }

  get idGerado(): string {
    return this.cifra().id || '(preencha o título)';
  }

  // ─── Seleção / Copiar / Colar ────────────────────────────────────────────────

  selecionadas = signal<Set<string>>(new Set());
  clipboard    = signal<LinhaCifra[] | null>(null);
  temSelecao   = computed(() => this.selecionadas().size > 0);

  linhaKey(si: number, li: number) { return `${si}-${li}`; }

  isSelected(si: number, li: number) {
    return this.selecionadas().has(this.linhaKey(si, li));
  }

  toggleSelecao(si: number, li: number) {
    this.selecionadas.update(s => {
      const n = new Set(s);
      const k = this.linhaKey(si, li);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  limparSelecao() { this.selecionadas.set(new Set()); }

  private _linhasSelecionadas(): LinhaCifra[] {
    const keys = this.selecionadas();
    const out: LinhaCifra[] = [];
    this.cifra().secoes.forEach((s, si) => s.linhas.forEach((l, li) => {
      if (keys.has(this.linhaKey(si, li))) out.push(JSON.parse(JSON.stringify(l)));
    }));
    return out;
  }

  copiarSelecionadas() {
    this.clipboard.set(this._linhasSelecionadas());
    this.selecionadas.set(new Set());
  }

  recortarSelecionadas() {
    this.clipboard.set(this._linhasSelecionadas());
    const keys = this.selecionadas();
    this.cifra.update(c => ({
      ...c, secoes: c.secoes.map((s, si) => ({
        ...s, linhas: s.linhas.filter((_, li) => !keys.has(this.linhaKey(si, li))),
      })),
    }));
    this.selecionadas.set(new Set());
  }

  colarEm(si: number, li: number) {
    const linhas = this.clipboard();
    if (!linhas?.length) return;
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      const novas = [...secoes[si].linhas];
      novas.splice(li, 0, ...linhas.map(l => JSON.parse(JSON.stringify(l))));
      secoes[si] = { ...secoes[si], linhas: novas };
      return { ...c, secoes };
    });
  }

  // ─── Drag & Drop de linhas ───────────────────────────────────────────────────

  onLinhasDrop(event: CdkDragDrop<number>) {
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;
    const fromSi = event.previousContainer.data;
    const toSi   = event.container.data;
    this.cifra.update(c => {
      const secoes = c.secoes.map(s => ({ ...s, linhas: [...s.linhas] }));
      const [linha] = secoes[fromSi].linhas.splice(event.previousIndex, 1);
      secoes[toSi].linhas.splice(event.currentIndex, 0, linha);
      return { ...c, secoes };
    });
    this.selecionadas.set(new Set());
  }
}
