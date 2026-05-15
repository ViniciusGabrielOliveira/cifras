"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCifraClubSong = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
exports.importCifraClubSong = (0, https_1.onCall)({ cors: true }, async (request) => {
    // ── Auth ────────────────────────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária');
    }
    const db = (0, firestore_1.getFirestore)();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas administradores podem importar músicas');
    }
    // ── Validação da URL ────────────────────────────────────────────
    const { url } = request.data;
    if (!url || !/^https?:\/\/(www\.)?cifraclub\.com\.br\//.test(url)) {
        throw new https_1.HttpsError('invalid-argument', 'A URL deve pertencer ao domínio cifraclub.com.br');
    }
    // ── Fetch ────────────────────────────────────────────────────────
    let html;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'pt-BR,pt;q=0.9',
            },
        });
        if (!response.ok) {
            throw new https_1.HttpsError('unavailable', `Cifra Club retornou status ${response.status}`);
        }
        html = await response.text();
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError('unavailable', 'Não foi possível acessar a página do Cifra Club');
    }
    return parseCifraClubPage(html, url);
});
function parseCifraClubPage(html, sourceUrl) {
    // ── Título ───────────────────────────────────────────────────────
    const title = html.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() ||
        html.match(/<h1[^>]*class="[^"]*t1[^"]*"[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() ||
        html.match(/<title>\s*([^<\-|–]+?)\s*[-|–]/)?.[1]?.trim() ||
        '';
    // ── Artista ──────────────────────────────────────────────────────
    const artist = html.match(/<h2[^>]*itemprop="byArtist"[^>]*>(?:[\s\S]*?<a[^>]*>)?\s*([^<]+?)\s*<\/(?:a|h2)>/)?.[1]?.trim() ||
        html.match(/<h2[^>]*class="[^"]*t3[^"]*"[^>]*>(?:[\s\S]*?<a[^>]*>)?\s*([^<]+?)\s*<\/(?:a|h2)>/)?.[1]?.trim() ||
        '';
    // ── Tom ──────────────────────────────────────────────────────────
    const tom = sourceUrl.match(/[?&]tom=([A-G][^&]*)/)?.[1]?.trim() ||
        html.match(/<a[^>]*class="[^"]*\bactive\b[^"]*"[^>]*>\s*([A-G][^<]*?)\s*<\/a>/)?.[1]?.trim() ||
        html.match(/data-cifra-key="([^"]+)"/)?.[1]?.trim() ||
        'C';
    // ── Letra com cifras ─────────────────────────────────────────────
    // Tenta vários seletores comuns do Cifra Club
    const preContent = html.match(/<pre[^>]*id="pre_cifra"[^>]*>([\s\S]*?)<\/pre>/)?.[1] ||
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
    return { title, artist, tom, lyricsWithChords, sourceUrl };
}
//# sourceMappingURL=index.js.map