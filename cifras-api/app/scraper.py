"""
Lógica de fetch e parse do Cifra Club.

- Autocomplete (SOLR): usa httpx — endpoint simples, sem bot detection.
- Páginas de cifra: usa curl_cffi com impersonation Chrome — Akamai bloqueia
  requests com TLS fingerprint que não seja de um browser real.
"""

import re
import json
import httpx
from curl_cffi.requests import AsyncSession
from typing import Optional

HEADERS_BROWSER = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Referer": "https://www.cifraclub.com.br/",
}

SOLR_URL = "https://solr.sscdn.co/cc/c7/"


# ── Autocomplete ─────────────────────────────────────────────────────────────

async def buscar_sugestoes(termo: str) -> list[dict]:
    """
    Busca sugestões de músicas na API de autocomplete do Cifra Club.

    O endpoint retorna JSON com docs de vários tipos:
      tipo=1  artista
      tipo=2  música  ← único tipo útil (tem dns + url para montar a URL da cifra)
      tipo=6  álbum
    """
    params = {"q": termo, "limit": 30}
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.get(SOLR_URL, params=params, headers=HEADERS_BROWSER)
        response.raise_for_status()

    data = response.json()
    docs = data.get("response", {}).get("docs") or []

    # Filtra apenas músicas (tipo=2) que tenham os dois slugs necessários
    return [
        {
            "id":      str(item.get("id_song", item.get("url", ""))),
            "nome":    item.get("txt", ""),
            "artista": item.get("art", ""),
            "dns":     item.get("dns", ""),
            "url":     item.get("url", ""),
        }
        for item in docs
        if item.get("tipo") == "2" and item.get("dns") and item.get("url")
    ]


# ── Scraper ──────────────────────────────────────────────────────────────────

_IMPERSONATE_VERSIONS = ["chrome131", "chrome124", "chrome120"]

async def importar_cifra(url: str) -> dict:
    """
    Faz o fetch e parse de uma página do Cifra Club.
    Usa curl_cffi para imitar o TLS fingerprint do Chrome e passar pelo Akamai.
    Tenta versões progressivamente mais antigas se a mais nova for bloqueada.
    """
    last_exc: Exception = RuntimeError("Nenhuma tentativa realizada")

    for version in _IMPERSONATE_VERSIONS:
        try:
            async with AsyncSession() as session:
                response = await session.get(
                    url,
                    impersonate=version,
                    headers={"Accept-Language": "pt-BR,pt;q=0.9"},
                    timeout=15,
                    allow_redirects=True,
                )
                response.raise_for_status()
            return _parse_page(response.text, str(response.url))
        except Exception as exc:
            last_exc = exc
            continue

    raise last_exc


_TONS_VALIDOS = {
    'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
    'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm',
}

_TOM_RE = re.compile(r'^[A-G][b#]?m?$')
_ACORDE_TOKEN_RE = re.compile(r'^([A-G][#b]?)(?:m(?!aj)|maj|min|dim|aug|sus[24]?|add\d*|[679]|11|13|M)?(?:/[A-G][#b]?)?$')

# Cromatismo: índice 0=C, 1=C#/Db, ..., 11=B
_NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
_ENARM = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B','Fb':'E','B#':'C','E#':'F'}

# Semitons da escala maior e menor natural a partir da tônica
_SEMI_MAIOR = frozenset([0, 2, 4, 5, 7, 9, 11])
_SEMI_MENOR = frozenset([0, 2, 3, 5, 7, 8, 10])


def _normalizar_tom(tom: str) -> str:
    """Valida o tom contra os tons suportados pelo sistema."""
    tom = tom.strip()
    return tom if tom in _TONS_VALIDOS else 'C'


def _idx_nota(nota: str) -> int:
    return _NOTAS.index(_ENARM.get(nota, nota))


def _tom_from_lyrics(lyrics: str) -> str:
    """Infere o tom verificando qual escala maior/menor abriga mais acordes da cifra.

    Para cada tonalidade em _TONS_VALIDOS calcula:
      - pontos pela raiz de cada acorde que pertence à escala
      - bônus quando o acorde tônico (raiz + qualidade) aparece na cifra
    A tonalidade com maior pontuação é retornada.
    """
    # Extrai pares (idx_cromático, is_minor) de todas as linhas de acorde
    chord_data: list[tuple[int, bool]] = []
    for line in lyrics.split('\n'):
        tokens = line.strip().split()
        if len(tokens) < 2:
            continue
        if not all(_ACORDE_TOKEN_RE.match(t) for t in tokens):
            continue
        for t in tokens:
            m = re.match(r'^([A-G][#b]?)(m(?!aj))?', t)
            if m:
                try:
                    chord_data.append((_idx_nota(m.group(1)), bool(m.group(2))))
                except (ValueError, KeyError):
                    pass

    if not chord_data:
        return 'C'

    best_key, best_score = 'C', -1

    for key in _TONS_VALIDOS:
        is_minor_key = key.endswith('m')
        tonica_str = key[:-1] if is_minor_key else key
        try:
            tonica_idx = _idx_nota(tonica_str)
        except (ValueError, KeyError):
            continue

        escala = _SEMI_MENOR if is_minor_key else _SEMI_MAIOR
        escala_idxs = frozenset((tonica_idx + s) % 12 for s in escala)

        # 1 ponto por acorde com raiz na escala
        score = sum(1 for (idx, _) in chord_data if idx in escala_idxs)

        # Bônus: acorde tônico (raiz + qualidade) presente na cifra
        bonus = sum(1 for (idx, is_m) in chord_data
                    if idx == tonica_idx and is_m == is_minor_key)

        final = score * 10 + bonus
        if final > best_score:
            best_score, best_key = final, key

    return best_key


def _tom_from_next_data(html: str) -> Optional[str]:
    """Extrai o tom do __NEXT_DATA__ do Next.js navegando por caminhos específicos."""
    m = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', html)
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
        page_props = data.get('props', {}).get('pageProps', {})

        paths = [
            ['cifra', 'key'],
            ['cifra', 'tom'],
            ['cifra', 'cifraKey'],
            ['data', 'cifra', 'key'],
            ['data', 'key'],
            ['song', 'key'],
            ['song', 'tom'],
        ]
        for path in paths:
            val = page_props
            for step in path:
                val = val.get(step) if isinstance(val, dict) else None
            if isinstance(val, str) and _TOM_RE.match(val):
                return val

        val = _find_specific_key(page_props, 'cifraKey')
        if isinstance(val, str) and _TOM_RE.match(val):
            return val
    except Exception:
        pass
    return None


def _find_specific_key(obj, key: str):
    """Busca recursiva por uma chave específica (use apenas para nomes únicos)."""
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            result = _find_specific_key(v, key)
            if result is not None:
                return result
    elif isinstance(obj, list):
        for item in obj:
            result = _find_specific_key(item, key)
            if result is not None:
                return result
    return None


def _parse_page(html: str, source_url: str) -> dict:
    title = (
        _match(html, r'<h1[^>]*itemprop="name"[^>]*>([^<]+)</h1>')
        or _match(html, r'<h1[^>]*class="[^"]*t1[^"]*"[^>]*>([^<]+)</h1>')
        or _match(html, r"<title>\s*([^<\-|–]+?)\s*[-|–]")
        or ""
    )

    artist = (
        _match(html, r'<h2[^>]*itemprop="byArtist"[^>]*>(?:[\s\S]*?<a[^>]*>)?\s*([^<]+?)\s*</(?:a|h2)>')
        or _match(html, r'<h2[^>]*class="[^"]*t3[^"]*"[^>]*>(?:[\s\S]*?<a[^>]*>)?\s*([^<]+?)\s*</(?:a|h2)>')
        or ""
    )

    # Extrai lyrics antes do tom para poder usá-los como fallback
    raw = (
        _match(html, r'<pre[^>]*id="pre_cifra"[^>]*>([\s\S]*?)</pre>')
        or _match(html, r'<div[^>]*id="cifra_v"[^>]*>[\s\S]*?<pre[^>]*>([\s\S]*?)</pre>')
        or _match(html, r'<div[^>]*class="[^"]*cifra_cont[^"]*"[^>]*>[\s\S]*?<pre[^>]*>([\s\S]*?)</pre>')
        or _match(html, r"<pre[^>]*>([\s\S]*?)</pre>")
        or ""
    )

    lyrics = (
        raw
        .replace("<b>", "").replace("</b>", "")
        .replace("<B>", "").replace("</B>", "")
    )
    lyrics = re.sub(r"<[^>]+>", "", lyrics)
    lyrics = (
        lyrics
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .strip()
    )

    tom_raw = (
        _match(html, r'id="cifra_tom"[^>]*>[\s\S]*?<a[^>]*>\s*([A-G][b#]?m?)\s*</a>')
        or _tom_from_next_data(html)
        or _match(source_url, r"[?&]tom=([A-G][b#]?m?)")
        or _match(html, r'data-cifra-key="([A-G][b#]?m?)"')
        or _match(html, r'data-key="([A-G][b#]?m?)"')
        or _match(html, r'"cifraKey"\s*:\s*"([A-G][b#]?m?)"')
        or _match(html, r'"tom"\s*:\s*"([A-G][b#]?m?)"')
        or _match(html, r'[?&]tom=([A-G][b#]?m?)["&\s]')
        or _match(html, r'<a[^>]*href="[^"]*[?&]tom=([A-G][b#]?m?)"[^>]*class="[^"]*\bactive\b')
        or _match(html, r'<a[^>]*class="[^"]*\bactive\b[^"]*"[^>]*href="[^"]*[?&]tom=([A-G][b#]?m?)"')
        or _tom_from_lyrics(lyrics)
    )
    tom = _normalizar_tom(tom_raw)

    return {
        "title":           title.strip(),
        "artist":          artist.strip(),
        "tom":             tom.strip(),
        "lyricsWithChords": lyrics,
        "sourceUrl":       source_url,
    }


def _match(text: str, pattern: str) -> Optional[str]:
    m = re.search(pattern, text)
    return m.group(1).strip() if m else None
