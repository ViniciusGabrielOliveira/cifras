"""
Lógica de fetch e parse do Cifra Club.
"""

import re
import json
import httpx
from typing import Optional

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

SOLR_URL = "https://solr.sscdn.co/cc/c7/"


# ── Autocomplete ─────────────────────────────────────────────────────────────

async def buscar_sugestoes(termo: str) -> list[dict]:
    """Busca sugestões de músicas na API de autocomplete do Cifra Club."""
    params = {"q": termo, "limit": 30, "callback": "cb"}
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.get(SOLR_URL, params=params, headers=HEADERS)
        response.raise_for_status()

    # Desempacota JSONP: cb({...}) → {...}
    text = response.text
    inner = re.sub(r"^[^(]+\(", "", text).rstrip(");").strip()
    data = json.loads(inner)

    return [
        {
            "id":     item.get("id", ""),
            "nome":   item.get("n", ""),
            "artista": item.get("a", ""),
            "dns":    item.get("dns", ""),
            "url":    item.get("url", ""),
        }
        for item in (data.get("d", {}).get("items") or [])
    ]


# ── Scraper ──────────────────────────────────────────────────────────────────

async def importar_cifra(url: str) -> dict:
    """Faz o fetch e parse de uma página do Cifra Club."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        response = await client.get(url, headers=HEADERS)
        response.raise_for_status()

    html = response.text
    return _parse_page(html, url)


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
