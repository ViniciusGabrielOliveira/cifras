import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Cifra, Secao, LinhaCifra, TipoSecao } from '../../models/cifra.model';
import { CifraService } from '../../services/cifra';
import { LinhaEditorComponent } from '../../components/linha-editor/linha-editor';

const TIPOS: TipoSecao[] = ['intro', 'verso', 'pre-refrao', 'refrao', 'ponte', 'outro', 'solo'];

@Component({
  selector: 'app-cifra-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, LinhaEditorComponent],
  templateUrl: './cifra-editor.html',
  styleUrl: './cifra-editor.scss',
})
export class CifraEditorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cifraService = inject(CifraService);

  cifra = signal<Cifra | null>(null);
  loading = signal(true);
  saving = signal(false);
  saved = signal(false);
  showJSON = signal(false);
  jsonPreview = signal('');

  readonly tiposSecao = TIPOS;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? 'harpa-crista-porque-ele-vive';
    this.cifraService.getCifra(id).subscribe(c => {
      if (c) this.cifra.set(JSON.parse(JSON.stringify(c))); // deep clone
      this.loading.set(false);
    });
  }

  // ─── Seções ─────────────────────────────────────────────────────────────────

  addSecao() {
    const nova: Secao = { tipo: 'verso', label: 'Nova Seção', linhas: [{ letra: '', acordes: [] }] };
    this.cifra.update(c => c ? { ...c, secoes: [...c.secoes, nova] } : c);
  }

  removeSecao(idx: number) {
    this.cifra.update(c => c ? { ...c, secoes: c.secoes.filter((_, i) => i !== idx) } : c);
  }

  updateSecaoLabel(idx: number, label: string) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      secoes[idx] = { ...secoes[idx], label };
      return { ...c, secoes };
    });
  }

  updateSecaoTipo(idx: number, tipo: TipoSecao) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      secoes[idx] = { ...secoes[idx], tipo };
      return { ...c, secoes };
    });
  }

  // ─── Linhas ─────────────────────────────────────────────────────────────────

  addLinha(secaoIdx: number) {
    const novaLinha: LinhaCifra = { letra: '', acordes: [] };
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      secoes[secaoIdx] = {
        ...secoes[secaoIdx],
        linhas: [...secoes[secaoIdx].linhas, novaLinha],
      };
      return { ...c, secoes };
    });
  }

  removeLinha(secaoIdx: number, linhaIdx: number) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      const linhas = secoes[secaoIdx].linhas.filter((_, i) => i !== linhaIdx);
      secoes[secaoIdx] = { ...secoes[secaoIdx], linhas };
      return { ...c, secoes };
    });
  }

  updateLinha(secaoIdx: number, linhaIdx: number, linha: LinhaCifra) {
    this.cifra.update(c => {
      if (!c) return c;
      const secoes = [...c.secoes];
      const linhas = [...secoes[secaoIdx].linhas];
      linhas[linhaIdx] = linha;
      secoes[secaoIdx] = { ...secoes[secaoIdx], linhas };
      return { ...c, secoes };
    });
  }

  // ─── Metadados ──────────────────────────────────────────────────────────────

  updateMeta(field: keyof Cifra, value: string) {
    this.cifra.update(c => c ? { ...c, [field]: value } : c);
  }

  // ─── Salvar ─────────────────────────────────────────────────────────────────

  salvar() {
    const c = this.cifra();
    if (!c) return;
    this.saving.set(true);
    this.cifraService.salvarCifra(c).subscribe(() => {
      this.saving.set(false);
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2500);
    });
  }

  toggleJSON() {
    const c = this.cifra();
    if (!c) return;
    this.jsonPreview.set(this.cifraService.getJSONString(c.id) || JSON.stringify(c, null, 2));
    this.showJSON.update(v => !v);
  }

  exportarJSON() {
    const c = this.cifra();
    if (!c) return;
    this.cifraService.salvarCifra(c).subscribe(() => {
      this.cifraService.exportarJSON(c.id);
    });
  }

  copiarJSON() {
    const c = this.cifra();
    if (!c) return;
    const json = this.cifraService.getJSONString(c.id) || JSON.stringify(c, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 1500);
    });
  }

  resetarOriginal() {
    const c = this.cifra();
    if (!c) return;
    if (!confirm('Descartar todas as edições e voltar ao JSON original?')) return;
    this.cifraService.resetarOriginal(c.id).subscribe(original => {
      if (original) this.cifra.set(JSON.parse(JSON.stringify(original)));
    });
  }

  voltarParaVisualizacao() {
    const c = this.cifra();
    if (c) this.router.navigate(['/cifra', c.id]);
  }
}
