import { Injectable, inject } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FIREBASE_APP } from '../firebase.providers';

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
  private app = inject(FIREBASE_APP);

  async buscarSugestoes(termo: string): Promise<CifraClubSugestao[]> {
    if (!termo.trim()) return [];
    const url = `https://solr.sscdn.co/cc/c7/?q=${encodeURIComponent(termo)}&limit=30&callback=suggest_callback`;
    const response = await fetch(url);
    const text = await response.text();
    // Extrai o JSON do wrapper JSONP: suggest_callback({...})
    const json = text.replace(/^[^(]+\(/, '').replace(/\)\s*;?\s*$/, '');
    const data = JSON.parse(json);
    return (data?.d?.items ?? []).map((item: Record<string, string>) => ({
      id: item['id'],
      nome: item['n'],
      artista: item['a'],
      dns: item['dns'],
      url: item['url'],
    }));
  }

  async importarMusica(sugestao: CifraClubSugestao): Promise<CifraClubImportResult> {
    const cifraUrl = `https://www.cifraclub.com.br/${sugestao.dns}/${sugestao.url}/`;
    const fns = getFunctions(this.app, 'southamerica-east1');
    const importar = httpsCallable<{ url: string }, CifraClubImportResult>(fns, 'importCifraClubSong');
    const result = await importar({ url: cifraUrl });
    return result.data;
  }
}
