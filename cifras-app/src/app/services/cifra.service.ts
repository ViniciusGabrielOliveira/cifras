import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { Cifra, CifraPR, CifraCustom, CifraVersao, MotivoVersao } from '../models/cifra.model';
import { CifraRepository, CifraIndiceItem } from '../repositories/cifra.repository.interface';
import { AcordesService } from './acordes.service';

/**
 * Camada de serviço — regras de negócio sobre cifras.
 * As páginas/componentes injetam ESTE service, nunca o repositório diretamente.
 * O service delega ao CifraRepository para acesso a dados.
 */
@Injectable({ providedIn: 'root' })
export class CifraService {
  private repo = inject(CifraRepository);
  private acordesService = inject(AcordesService);

  getCifra(id: string): Observable<Cifra | undefined> {
    return this.repo.getCifra(id).pipe(
      tap(cifra => {
        if (!cifra) return;
        const acordesSet = new Set<string>();
        for (const s of cifra.secoes) {
          for (const l of s.linhas) {
            for (const a of l.acordes) {
              acordesSet.add(a.acorde);
            }
          }
        }
        const acordesUnicos = Array.from(acordesSet);
        // Dispara o pré-carregamento sem bloquear o fluxo principal (fire and forget)
        this.acordesService.preCarregarAcordes(acordesUnicos).subscribe();
      })
    );
  }

  getAllCifras(): Observable<Cifra[]> {
    return this.repo.getAllCifras();
  }

  /**
   * Persiste as alterações no repositório.
   * Retorna um Observable<Cifra> com a versão salva.
   */
  salvarCifra(cifra: Cifra): Observable<Cifra> {
    return this.repo.updateCifra(cifra);
  }

  deleteCifra(id: string): Observable<void> {
    return this.repo.deleteCifra(id);
  }

  getIndice(): Observable<CifraIndiceItem[]> {
    return this.repo.getIndice();
  }

  getCifrasPrivadas(): Observable<Cifra[]> {
    return this.repo.getCifrasPrivadas();
  }

  getCifrasDoUser(uid: string): Observable<Cifra[]> {
    return this.repo.getCifrasDoUser(uid);
  }

  countCifrasDoUser(uid: string): Observable<number> {
    return this.repo.countCifrasDoUser(uid);
  }

  // ── Cifra local da lista ─────────────────────────────────────────

  salvarCifraEmLista(listaId: string, cifra: Cifra): Observable<void> {
    return this.repo.salvarCifraEmLista(listaId, cifra);
  }

  getCifraEmLista(listaId: string, cifraId: string): Observable<Cifra | undefined> {
    return this.repo.getCifraEmLista(listaId, cifraId);
  }

  // ── Controle de visibilidade via listas ──────────────────────────

  atualizarListasIds(cifraId: string, listaId: string, operacao: 'add' | 'remove'): Observable<void> {
    return this.repo.atualizarListasIds(cifraId, listaId, operacao);
  }

  // ── Pull Requests ────────────────────────────────────────────────

  submeterPR(
    cifra: Omit<Cifra, 'id' | 'listasIds'>,
    cifraId: string | null,
    autorUid: string,
    autorNome: string,
    motivo?: MotivoVersao,
    motivoCustom?: string,
  ): Observable<CifraPR> {
    const pr: Omit<CifraPR, 'id'> = {
      cifraId,
      tipo: cifraId ? 'nova_versao' : 'nova_cifra',
      dados: cifra,
      autorUid,
      autorNome,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      ...(motivo       !== undefined ? { motivo }       : {}),
      ...(motivoCustom !== undefined ? { motivoCustom } : {}),
    };
    return this.repo.criarPR(pr);
  }

  getPRsPendentes(): Observable<CifraPR[]> {
    return this.repo.getPRsPendentes();
  }

  getPRsDoUser(uid: string): Observable<CifraPR[]> {
    return this.repo.getPRsDoUser(uid);
  }

  getPR(id: string): Observable<CifraPR | undefined> {
    return this.repo.getPR(id);
  }

  /**
   * Aprova uma PR:
   * - nova_cifra: cria a cifra com status 'publica'
   * - nova_versao: arquiva versão atual em subcoleção e atualiza a cifra
   */
  aprovarPR(pr: CifraPR, reviewerUid: string, nota?: string): Observable<void> {
    if (pr.tipo === 'nova_cifra') {
      const novaCifra: Cifra = {
        ...pr.dados,
        id: this.gerarSlug(pr.dados.titulo, pr.dados.artista),
        status: 'publica',
      };
      return this.repo.updateCifra(novaCifra).pipe(
        switchMap(() => this.repo.resolverPR(pr.id, 'aprovado', reviewerUid, nota)),
      );
    }

    // nova_versao: busca cifra atual, arquiva e aplica nova versão
    return this.repo.getCifra(pr.cifraId!).pipe(
      switchMap(cifraAtual => {
        if (!cifraAtual) throw new Error('Cifra original não encontrada');
        const versaoArquivada: CifraVersao = {
          id: '',
          titulo: cifraAtual.titulo,
          artista: cifraAtual.artista,
          tom: cifraAtual.tom,
          instrumento: cifraAtual.instrumento,
          dificuldade: cifraAtual.dificuldade,
          composicao: cifraAtual.composicao,
          secoes: cifraAtual.secoes,
          aprovadoEm: new Date().toISOString(),
          autorUid: cifraAtual.donoUid ?? '',
          autorNome: '',
          motivo: pr.motivo,
          motivoCustom: pr.motivoCustom,
        };
        const cifraAtualizada: Cifra = {
          ...cifraAtual,
          ...pr.dados,
          id: cifraAtual.id,
          status: 'publica',
        };
        return this.repo.updateCifra(cifraAtualizada).pipe(
          switchMap(() => this.salvarVersaoArquivada(cifraAtual.id, versaoArquivada)),
          switchMap(() => this.repo.resolverPR(pr.id, 'aprovado', reviewerUid, nota)),
        );
      }),
    );
  }

  rejeitarPR(prId: string, reviewerUid: string, nota?: string): Observable<void> {
    return this.repo.resolverPR(prId, 'rejeitado', reviewerUid, nota);
  }

  getVersoes(cifraId: string): Observable<CifraVersao[]> {
    return this.repo.getVersoes(cifraId);
  }

  salvarCifraCustom(custom: CifraCustom): Observable<CifraCustom> {
    return this.repo.salvarCifraCustom(custom);
  }

  getCifraCustom(uid: string, cifraId: string): Observable<CifraCustom | undefined> {
    return this.repo.getCifraCustom(uid, cifraId);
  }

  reindexarIndice(): Observable<{ total: number; atualizadas: number }> {
    return this.repo.reindexarIndice();
  }

  private salvarVersaoArquivada(cifraId: string, versao: Omit<CifraVersao, 'id'>): Observable<void> {
    return this.repo.salvarVersaoArquivada(cifraId, versao);
  }

  private gerarSlug(titulo: string, artista: string): string {
    const slugify = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    return `${slugify(artista)}-${slugify(titulo)}`;
  }
}
