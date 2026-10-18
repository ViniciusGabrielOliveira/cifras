import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AcordeLinha, Cifra } from '../models/cifra.model';
import { parseCifraTexto, slugify } from '../core/cifra-parser';
import { CifraService } from './cifra.service';
import { AuthService } from './auth.service';

const SOLR_URL = 'https://solr.sscdn.co/cc/c7/';

interface SolrDoc {
  id_song?: string | number;
  url?: string;
  txt?: string;
  art?: string;
  dns?: string;
  tipo?: string;
}

export interface CifraClubSugestao {
  id: string;
  nome: string;
  artista: string;
  dns: string;
  url: string;
}

export interface CifraClubImportResult {
  title: string;
  artist: string;
  tom: string;
  lyricsWithChords: string;
  chordLines?: AcordeLinha[][];
  sourceUrl: string;
}

@Injectable({ providedIn: 'root' })
export class CifraClubImportService {
  private http         = inject(HttpClient);
  private cifraService = inject(CifraService);
  private authService  = inject(AuthService);

  /** Resultado de um import pendente — consumido por nova-cifra ao abrir */
  pendingImport: CifraClubImportResult | null = null;

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'X-API-Key': environment.cifrasApiKey });
  }

  buscarSugestoes(termo: string): Observable<CifraClubSugestao[]> {
    return this.http.get<{ response: { docs: SolrDoc[] } }>(SOLR_URL, {
      params: { q: termo.trim(), limit: '30' },
    }).pipe(
      map(data =>
        (data?.response?.docs ?? [])
          .filter((d): d is SolrDoc & { dns: string; url: string } =>
            d.tipo === '2' && !!d.dns && !!d.url
          )
          .map(d => ({
            id:      String(d.id_song ?? d.url),
            nome:    d.txt ?? '',
            artista: d.art ?? '',
            dns:     d.dns,
            url:     d.url,
          }))
      ),
    );
  }

  async importarMusica(sugestao: CifraClubSugestao): Promise<CifraClubImportResult> {
    const cifraUrl = `https://www.cifraclub.com.br/${sugestao.dns}/${sugestao.url}/`;
    console.info('[CifraImport:v2] Solicitando importação', { url: cifraUrl });
    const result = await firstValueFrom(
      this.http.get<CifraClubImportResult>(`${environment.cifrasApiUrl}/importar`, {
        headers: this.headers,
        params: { url: cifraUrl },
      })
    );
    console.info('[CifraImport:v2] Resposta da API', {
      url: result.sourceUrl,
      marcacaoHtml: result.chordLines !== undefined,
      linhasTexto: result.lyricsWithChords.split('\n').length,
      linhasMarcadas: result.chordLines?.length,
      totalAcordes: result.chordLines?.reduce((total, linha) => total + linha.length, 0),
      nomes: [...new Set(result.chordLines?.flat().map(a => a.acorde) ?? [])],
    });
    if (!result.chordLines) console.warn('[CifraImport:v2] API sem marcação HTML; usando reconhecimento por texto');
    return result;
  }

  /** Scrapa, parseia e salva no Firebase. Retorna a Cifra salva. */
  async importarESalvar(sugestao: CifraClubSugestao): Promise<Cifra> {
    const result = await this.importarMusica(sugestao);

    const titulo  = result.title  || sugestao.nome;
    const artista = result.artist || sugestao.artista;
    const id      = slugify(`${titulo} ${artista}`);
    const secoes  = parseCifraTexto(result.lyricsWithChords, result.chordLines);

    console.groupCollapsed('[CifraImport:v2] Resultado do parser');
    console.table(secoes.flatMap(secao => secao.linhas.map((linha, indice) => ({
      secao: secao.label, linha: indice + 1,
      acordes: linha.acordes.map(a => `${a.acorde}@${a.posicao}`).join(' '),
      texto: linha.letra.slice(0, 100), raw: linha.rawChordsLine,
    }))));
    console.groupEnd();

    const currentUser = this.authService.user();
    if (!currentUser) throw new Error('Usuário não autenticado');

    const cifra: Cifra = {
      id,
      titulo,
      artista,
      tom:          result.tom || 'C',
      instrumento:  'violao',
      dificuldade:  'basico',
      composicao:   '',
      categorias:   [],
      partesMissa:  [],
      secoes,
      sourceUrl:    result.sourceUrl,
      donoUid:      currentUser.uid,
    };

    const existente = await firstValueFrom(this.cifraService.getCifra(id));
    if (existente) {
      console.warn('[CifraImport:v2] Reutilizando cifra existente; importação nova não foi salva', {
        id, sourceUrl: existente.sourceUrl,
        acordesImportados: secoes.flatMap(s => s.linhas).flatMap(l => l.acordes).map(a => a.acorde),
        acordesSalvos: existente.secoes.flatMap(s => s.linhas).flatMap(l => l.acordes).map(a => a.acorde),
      });
      return existente;
    }

    await firstValueFrom(this.cifraService.salvarCifra(cifra));
    console.info('[CifraImport:v2] Cifra salva', { id });
    return cifra;
  }
}
