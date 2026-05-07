import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Cifra, Secao, LinhaCifra, TipoSecao } from '../../../models/cifra.model';
import { CifraService } from '../../../services/cifra';
import { LinhaEditorComponent } from '../../../components/linha-editor/linha-editor';

const TIPOS: TipoSecao[] = ['intro', 'verso', 'pre-refrao', 'refrao', 'ponte', 'outro', 'solo'];
const TONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
              'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];

/** Transforma um título em um slug válido para ID */
function slugify(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

@Component({
  selector: 'app-nova-cifra',
  standalone: true,
  imports: [CommonModule, FormsModule, LinhaEditorComponent],
  templateUrl: './nova-cifra.html',
  styleUrl: './nova-cifra.scss',
})
export class NovaCifraComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private cifraService = inject(CifraService);

  readonly tiposSecao = TIPOS;
  readonly tons = TONS;

  cifra = signal<Cifra>({
    id:          '',
    titulo:      '',
    artista:     '',
    tom:         'C',
    instrumento: 'violao',
    dificuldade: 'basico',
    composicao:  '',
    secoes: [{
      tipo:  'verso',
      label: 'Verso 1',
      linhas: [{ letra: '', acordes: [] }],
    }],
  });

  saving  = signal(false);
  saved   = signal(false);
  showJSON = signal(false);

  // Validação
  erroTitulo = signal(false);

  ngOnInit() {
    // Pré-preenche o título se veio via query param
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
      // Atualiza o ID automaticamente se o título mudar (enquanto não salvo)
      if (field === 'titulo') {
        updated.id = slugify(value);
      }
      return updated;
    });
    if (field === 'titulo') this.erroTitulo.set(false);
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

  updateSecaoTipo(idx: number, tipo: TipoSecao) {
    this.cifra.update(c => {
      const secoes = [...c.secoes];
      secoes[idx] = { ...secoes[idx], tipo };
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
    const cifra = this.cifra();
    if (!cifra.titulo.trim()) {
      this.erroTitulo.set(true);
      return;
    }
    this.saving.set(true);
    this.cifraService.salvarCifra(cifra).subscribe(() => {
      this.saving.set(false);
      this.saved.set(true);
      // Volta para o painel após salvar
      setTimeout(() => this.router.navigate(['/admin/painel'], {
        queryParams: { cifraAdicionada: cifra.id, nomeCifra: cifra.titulo },
      }), 800);
    });
  }

  cancelar() {
    if (confirm('Descartar a nova música?')) {
      this.router.navigate(['/admin/painel']);
    }
  }

  get jsonPreview(): string {
    return JSON.stringify(this.cifra(), null, 2);
  }

  get idGerado(): string {
    return this.cifra().id || '(preencha o título)';
  }
}
