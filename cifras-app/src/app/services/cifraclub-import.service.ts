import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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
  private http = inject(HttpClient);

  /** Resultado de um import pendente — consumido por nova-cifra ao abrir */
  pendingImport: CifraClubImportResult | null = null;

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'X-API-Key': environment.cifrasApiKey });
  }

  async buscarSugestoes(termo: string): Promise<CifraClubSugestao[]> {
    if (!termo.trim()) return [];
    const url = `${environment.cifrasApiUrl}/buscar`;
    return firstValueFrom(
      this.http.get<CifraClubSugestao[]>(url, {
        headers: this.headers,
        params: { q: termo.trim() },
      })
    );
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
}
