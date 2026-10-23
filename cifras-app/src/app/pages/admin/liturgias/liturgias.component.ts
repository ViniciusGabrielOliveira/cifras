import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { Lista } from '../../../models/lista.model';
import { ConfigLiturgia, DiaLiturgico, Liturgia } from '../../../models/liturgia.model';
import { ListaService } from '../../../services/lista.service';
import { LiturgiaService } from '../../../services/liturgia.service';
import { dataLiturgicaHoje } from '../../../core/liturgia';

@Component({
  selector: 'app-liturgias',
  imports: [FormsModule, RouterLink],
  templateUrl: './liturgias.component.html',
  styleUrl: './liturgias.component.scss',
})
export class LiturgiasComponent implements OnInit {
  private service = inject(LiturgiaService);
  private listaService = inject(ListaService);
  private router = inject(Router);
  readonly listas = signal<Lista[]>([]);
  readonly catalogo = signal<Liturgia[]>([]);
  readonly config = signal<ConfigLiturgia>({ locais: [], ajustes: {} });
  readonly data = signal(dataLiturgicaHoje());
  readonly dia = signal<DiaLiturgico | null>(null);
  readonly opcoes = signal<DiaLiturgico[]>([]);
  readonly selecionada = signal('');
  readonly busca = signal('');
  readonly grupo = signal('');
  readonly semRepertorio = signal(false);
  readonly listaId = signal('');
  readonly ajusteId = signal('');
  readonly corLocal = signal('branco');
  readonly nomeLocal = signal('');
  readonly salvando = signal(false);
  readonly carregando = signal(true);
  readonly consultando = signal(false);
  readonly erro = signal('');
  readonly mensagem = signal('');
  readonly cores = ['branco', 'verde', 'roxo', 'vermelho', 'rosa', 'preto'];
  readonly grupos = ['Tempos litúrgicos', 'Celebrações', 'Domingos', 'Dias da semana', 'Celebrações locais'];
  readonly todas = computed(() => [...this.catalogo(), ...this.config().locais]);
  readonly atual = computed(() => this.todas().find(l => l.id === this.selecionada()));
  readonly filtradas = computed(() => {
    const texto = this.busca().toLocaleLowerCase('pt-BR');
    return this.todas().filter(l => (!this.grupo() || l.grupo === this.grupo()) && l.nome.toLocaleLowerCase('pt-BR').includes(texto) && (!this.semRepertorio() || this.quantidade(l.id) === 0));
  });
  readonly vinculadas = computed(() => this.listas().filter(l => l.liturgiasIds?.includes(this.selecionada())));
  readonly disponiveis = computed(() => this.listas().filter(l => !l.liturgiasIds?.includes(this.selecionada())));

  async ngOnInit() {
    try {
      const [catalogo, config, listas] = await firstValueFrom(forkJoin([this.service.catalogo$, this.service.getConfig(), this.listaService.getListas()]));
      this.catalogo.set(catalogo.liturgias);
      this.config.set(config);
      this.listas.set(listas.filter(l => l.tipo !== 'privada'));
      await this.consultarData(this.data());
      this.selecionada.set(this.dia()?.id ?? 'tempo-comum');
    } catch { this.erro.set('Não foi possível carregar as liturgias. Recarregue a página.'); }
    finally { this.carregando.set(false); }
  }

  quantidade(id: string): number { return this.listas().filter(l => l.liturgiasIds?.includes(id) && l.musicas.length > 0).length; }

  async consultarData(data: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    this.data.set(data);
    this.dia.set(null);
    this.consultando.set(true);
    this.erro.set('');
    try {
      const [dia, opcoes] = await firstValueFrom(forkJoin([this.service.dia(data), this.service.opcoesDoDia(data)]));
      if (this.data() !== data) return;
      this.dia.set(dia); this.opcoes.set(opcoes);
      this.ajusteId.set(this.config().ajustes[data]?.liturgiaId ?? '');
      this.corLocal.set(dia.cor || 'branco');
    } catch { if (this.data() === data) this.erro.set('Calendário indisponível para esta data. Escolha um ano de 2025 a 2035.'); }
    finally { if (this.data() === data) this.consultando.set(false); }
  }

  private async executar(acao: () => Promise<void>) {
    if (this.salvando()) return;
    this.salvando.set(true); this.erro.set(''); this.mensagem.set('');
    try { await acao(); this.mensagem.set('Alterações salvas.'); }
    catch { this.erro.set('Não foi possível salvar. Tente novamente.'); }
    finally { this.salvando.set(false); }
  }

  private async salvarLista(lista: Lista) {
    const salva = await firstValueFrom(this.listaService.salvarLista({ ...lista, tipo: 'publica' }));
    this.listas.update(ls => ls.map(l => l.id === salva.id ? salva : l));
  }

  vincular() {
    const lista = this.disponiveis().find(l => l.id === this.listaId());
    const id = this.selecionada();
    if (lista && id) void this.executar(async () => {
      await this.salvarLista({ ...lista, liturgiasIds: [...(lista.liturgiasIds ?? []), id] });
      this.listaId.set('');
    });
  }

  desvincular(lista: Lista) {
    const id = this.selecionada();
    void this.executar(() => this.salvarLista({ ...lista, liturgiasIds: (lista.liturgiasIds ?? []).filter(l => l !== id) }));
  }

  vincularData(lista: Lista, adicionar: boolean) {
    const data = this.data();
    const datas = (lista.datasLiturgicas ?? []).filter(d => d !== data);
    if (adicionar) datas.push(data);
    void this.executar(() => this.salvarLista({ ...lista, datasLiturgicas: datas }));
  }

  criarLista() {
    const liturgia = this.atual();
    if (!liturgia) return;
    void this.executar(async () => {
      const agora = new Date().toISOString();
      const lista = await firstValueFrom(this.listaService.salvarLista({ id: '', titulo: `${liturgia.nome} — Repertório`, tipo: 'publica', liturgiasIds: [liturgia.id], musicas: [], criadaEm: agora, atualizadaEm: agora }));
      await this.router.navigate(['/admin/lista', lista.id], { queryParams: { retorno: 'liturgias' } });
    });
  }

  criarLocal() {
    const nome = this.nomeLocal().trim();
    if (!nome) return;
    void this.executar(async () => {
      const local = { id: `local-${crypto.randomUUID()}`, nome, grupo: 'Celebrações locais' };
      const config = { ...this.config(), locais: [...this.config().locais, local] };
      await this.service.salvarConfig(config);
      this.config.set(config); this.nomeLocal.set(''); this.selecionada.set(local.id);
    });
  }

  salvarAjuste() {
    const data = this.data(), id = this.ajusteId();
    const opcao = this.opcoes().find(l => l.id === id);
    const local = this.config().locais.find(l => l.id === id);
    if (id && !opcao && !local) return;
    void this.executar(async () => {
      const ajustes = { ...this.config().ajustes };
      if (id) ajustes[data] = { liturgiaId: id, nome: (opcao ?? local)!.nome, cor: opcao?.cor || this.corLocal(), propria: opcao?.propria ?? true };
      else delete ajustes[data];
      const config = { ...this.config(), ajustes };
      await this.service.salvarConfig(config); this.config.set(config);
      await this.consultarData(data);
    });
  }
}
