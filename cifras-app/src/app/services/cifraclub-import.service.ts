import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Cifra } from '../models/cifra.model';
import { parseCifraTexto, slugify } from '../core/cifra-parser';
import { CifraService } from './cifra.service';
import { AuthService } from './auth.service';

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
  sourceUrl: string;
}

@Injectable({ providedIn: 'root' })
export class CifraClubImportService {
  private http        = inject(HttpClient);
  private cifraService = inject(CifraService);
  private auth        = inject(AuthService);

  /** Resultado de um import pendente — consumido por nova-cifra ao abrir */
  pendingImport: CifraClubImportResult | null = null;

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'X-API-Key': environment.cifrasApiKey });
  }

  buscarSugestoes(termo: string): Observable<CifraClubSugestao[]> {
    const url = `${environment.cifrasApiUrl}/buscar`;
    return this.http.get<CifraClubSugestao[]>(url, {
      headers: this.headers,
      params: { q: termo.trim() },
    });
  }

  async importarMusica(sugestao: CifraClubSugestao): Promise<CifraClubImportResult> {
    const cifraUrl = `https://www.cifraclub.com.br/${sugestao.dns}/${sugestao.url}/`;
    return firstValueFrom(
      this.http.get<CifraClubImportResult>(`${environment.cifrasApiUrl}/importar`, {
        headers: this.headers,
        params: { url: cifraUrl },
      })
    );
  }

  /** Scrapa, parseia e salva no Firebase. Retorna o cifraId gerado. */
  async importarESalvar(sugestao: CifraClubSugestao): Promise<string> {
    const result = await this.importarMusica(sugestao);
    const titulo  = result.title  || sugestao.nome;
    const artista = result.artist || sugestao.artista;
    const id      = slugify(`${titulo} ${artista}`);
    const secoes  = parseCifraTexto(result.lyricsWithChords);

    const uid = this.auth.user()?.uid;
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
      status:       'privada',
      donoUid:      uid,
    };

    await firstValueFrom(this.cifraService.salvarCifra(cifra));
    return id;
  }
}
