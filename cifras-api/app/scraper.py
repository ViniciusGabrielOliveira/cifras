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

    tom = (
        _match(source_url, r"[?&]tom=([A-G][^&]*)")
        or _match(html, r'<a[^>]*class="[^"]*\bactive\b[^"]*"[^>]*>\s*([A-G][^<]*?)\s*</a>')
        or _match(html, r'data-cifra-key="([^"]+)"')
        or "C"
    )

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
