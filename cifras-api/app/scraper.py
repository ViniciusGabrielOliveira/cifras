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

async def importar_cifra(url: str) -> dict:
    """
    Faz o fetch e parse de uma página do Cifra Club.
    Usa curl_cffi para imitar o TLS fingerprint do Chrome e passar pelo Akamai.
    """
    async with AsyncSession() as session:
        response = await session.get(
            url,
            impersonate="chrome120",
            headers={"Accept-Language": "pt-BR,pt;q=0.9"},
            timeout=15,
            allow_redirects=True,
        )
        response.raise_for_status()

    return _parse_page(response.text, str(response.url))


_TONS_VALIDOS = {
    'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
    'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm',
}

def _normalizar_tom(tom: str) -> str:
    """Valida o tom contra os tons suportados pelo sistema."""
    tom = tom.strip()
    return tom if tom in _TONS_VALIDOS else 'C'

def _tom_from_next_data(html: str) -> Optional[str]:
    """Tenta extrair o tom do __NEXT_DATA__ do Next.js."""
    m = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', html)
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
        # Procura recursivamente por chaves relacionadas ao tom
        for key in ('cifraKey', 'key', 'tom', 'tone'):
            val = _find_key(data, key)
            if val and isinstance(val, str) and re.match(r'^[A-G][b#]?m?$', val):
                return val
    except Exception:
        pass
    return None

def _find_key(obj, key: str):
    """Busca recursiva de uma chave em dicionário/lista aninhada."""
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            result = _find_key(v, key)
            if result is not None:
                return result
    elif isinstance(obj, list):
        for item in obj:
            result = _find_key(item, key)
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

    tom_raw = (
        _tom_from_next_data(html)
        or _match(source_url, r"[?&]tom=([A-G][b#]?m?)")
        or _match(html, r'data-cifra-key="([^"]+)"')
        or _match(html, r'data-key="([A-G][b#]?m?)"')
        or _match(html, r'"cifraKey"\s*:\s*"([^"]+)"')
        or _match(html, r'<a[^>]*class="[^"]*\bactive\b[^"]*"[^>]*href="[^"]*[?&]tom=([A-G][b#]?m?)[^"]*"')
        or "C"
    )
    tom = _normalizar_tom(tom_raw)

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
