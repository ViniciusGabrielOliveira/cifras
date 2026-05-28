import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

interface ImportRequest {
  url: string;
}

interface ImportResult {
  title: string;
  artist: string;
  tom: string;
  lyricsWithChords: string;
  sourceUrl: string;
}

export const importCifraClubSong = onCall<ImportRequest, Promise<ImportResult>>(
  { cors: true },
  async (request) => {
    // ── Auth ────────────────────────────────────────────────────────
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária');
    }

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores podem importar músicas');
    }

    // ── Validação da URL ────────────────────────────────────────────
    const { url } = request.data;
    if (!url || !/^https?:\/\/(www\.)?cifraclub\.com\.br\//.test(url)) {
      throw new HttpsError('invalid-argument', 'A URL deve pertencer ao domínio cifraclub.com.br');
    }

    // ── Fetch ────────────────────────────────────────────────────────
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      });
      if (!response.ok) {
        throw new HttpsError('unavailable', `Cifra Club retornou status ${response.status}`);
      }
      html = await response.text();
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('unavailable', 'Não foi possível acessar a página do Cifra Club');
    }

    return parseCifraClubPage(html, url);
  }
);

const TONS_VALIDOS = new Set([
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm',
]);

const CHORD_TOKEN_RE = /^([A-G](?:#|b)?)(?:m(?!aj)|maj|min|dim|aug|sus[24]?|add\d*|[679]|11|13|M)?(?:\/[A-G](?:#|b)?)?$/;

// Cromatismo: índice 0=C, 1=C#/Db, ..., 11=B
const NOTAS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ENARM: Record<string,string> = {Db:'C#',Eb:'D#',Gb:'F#',Ab:'G#',Bb:'A#',Cb:'B',Fb:'E','B#':'C','E#':'F'};

// Semitons da escala maior e menor natural a partir da tônica
const SEMI_MAIOR = [0, 2, 4, 5, 7, 9, 11];
const SEMI_MENOR = [0, 2, 3, 5, 7, 8, 10];

function idxNota(nota: string): number {
  const n = ENARM[nota] ?? nota;
  const i = NOTAS.indexOf(n);
  if (i === -1) throw new Error(`nota desconhecida: ${nota}`);
  return i;
}

function inferTomFromText(text: string): string {
  // Ignora o intro (linhas só de acordes antes da 1ª linha de letra)
  // e usa no máximo 30 acordes a partir da parte cantada.
  const lines = text.split('\n');

  let firstLyricIdx = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!stripped) continue;
    const tokens = stripped.split(/\s+/).filter(Boolean);
    if (!tokens.every(t => CHORD_TOKEN_RE.test(t))) { firstLyricIdx = i; break; }
  }

  const startIdx = Math.max(0, firstLyricIdx - 1);
  const MAX_CHORDS = 30;
  const chordData: Array<[number, boolean]> = [];

  for (let i = startIdx; i < lines.length; i++) {
    if (chordData.length >= MAX_CHORDS) break;
    const tokens = lines[i].trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;
    if (!tokens.every(t => CHORD_TOKEN_RE.test(t))) continue;
    for (const t of tokens) {
      const m = t.match(/^([A-G][#b]?)(m(?!aj))?/);
      if (!m) continue;
      try { chordData.push([idxNota(m[1]), !!m[2]]); } catch { /* nota inválida */ }
    }
  }

  if (chordData.length === 0) return 'C';

  let bestKey = 'C', bestScore = -1;

  for (const key of TONS_VALIDOS) {
    const isMinorKey = key.endsWith('m');
    const tonicaStr = isMinorKey ? key.slice(0, -1) : key;
    let tonicaIdx: number;
    try { tonicaIdx = idxNota(tonicaStr); } catch { continue; }

    const semi = isMinorKey ? SEMI_MENOR : SEMI_MAIOR;
    const escala = new Set(semi.map(s => (tonicaIdx + s) % 12));

    // 1 ponto por acorde com raiz na escala
    const score = chordData.filter(([idx]) => escala.has(idx)).length;

    // Bônus: acorde tônico (raiz + qualidade) aparece na cifra
    const bonus = chordData.filter(([idx, isM]) => idx === tonicaIdx && isM === isMinorKey).length;

    const final = score * 10 + bonus;
    if (final > bestScore) { bestScore = final; bestKey = key; }
  }

  return bestKey;
}

function parseCifraClubPage(html: string, sourceUrl: string): ImportResult {
  // ── Título ───────────────────────────────────────────────────────
  const title =
    html.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() ||
    html.match(/<h1[^>]*class="[^"]*t1[^"]*"[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() ||
    html.match(/<title>\s*([^<\-|–]+?)\s*[-|–]/)?.[1]?.trim() ||
    '';

  // ── Artista ──────────────────────────────────────────────────────
  const artist =
    html.match(/<h2[^>]*itemprop="byArtist"[^>]*>(?:[\s\S]*?<a[^>]*>)?\s*([^<]+?)\s*<\/(?:a|h2)>/)?.[1]?.trim() ||
    html.match(/<h2[^>]*class="[^"]*t3[^"]*"[^>]*>(?:[\s\S]*?<a[^>]*>)?\s*([^<]+?)\s*<\/(?:a|h2)>/)?.[1]?.trim() ||
    '';

  // ── Letra com cifras ─────────────────────────────────────────────
  // Tenta vários seletores comuns do Cifra Club
  const preContent =
    html.match(/<pre[^>]*id="pre_cifra"[^>]*>([\s\S]*?)<\/pre>/)?.[1] ||
    html.match(/<div[^>]*id="cifra_v"[^>]*>[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1] ||
    html.match(/<div[^>]*class="[^"]*cifra_cont[^"]*"[^>]*>[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1] ||
    html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1] ||
    '';

  const lyricsWithChords = preContent
    // Chords estão em <b>, manter apenas o texto
    .replace(/<b>/g, '')
    .replace(/<\/b>/g, '')
    // Remove demais tags
    .replace(/<[^>]+>/g, '')
    // Entidades HTML
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Normaliza quebras de linha
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // ── Tom ──────────────────────────────────────────────────────────
  // Tenta extrair da URL ou do HTML; se não encontrar, infere dos 5 primeiros acordes
  const tom =
    sourceUrl.match(/[?&]tom=([A-G][^&]*)/)?.[1]?.trim() ||
    html.match(/<a[^>]*class="[^"]*\bactive\b[^"]*"[^>]*>\s*([A-G][^<]*?)\s*<\/a>/)?.[1]?.trim() ||
    html.match(/data-cifra-key="([^"]+)"/)?.[1]?.trim() ||
    inferTomFromText(lyricsWithChords);

  return { title, artist, tom, lyricsWithChords, sourceUrl };
}
