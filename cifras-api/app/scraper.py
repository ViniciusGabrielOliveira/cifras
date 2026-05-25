"""
Lógica de fetch e parse do Cifra Club.

- Autocomplete (SOLR): usa httpx — endpoint simples, sem bot detection.
- Páginas de cifra: usa curl_cffi com impersonation Chrome — Akamai bloqueia
  requests com TLS fingerprint que não seja de um browser real.
"""

import re
import json
import logging
import httpx
from curl_cffi.requests import AsyncSession
from typing import Optional

logger = logging.getLogger(__name__)

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

_TOM_RE = re.compile(r'^[A-G][b#]?m?$')

def _tom_from_next_data(html: str) -> Optional[str]:
    """Extrai o tom do __NEXT_DATA__ do Next.js navegando por caminhos específicos."""
    m = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', html)
    if not m:
        logger.info('[tom] __NEXT_DATA__ não encontrado no HTML')
        return None
    try:
        data = json.loads(m.group(1))
        page_props = data.get('props', {}).get('pageProps', {})
        logger.info('[tom] pageProps keys: %s', list(page_props.keys()) if isinstance(page_props, dict) else type(page_props))

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
            logger.info('[tom] path %s → %r', path, val)
            if isinstance(val, str) and _TOM_RE.match(val):
                logger.info('[tom] encontrado via path %s: %s', path, val)
                return val

        val = _find_specific_key(page_props, 'cifraKey')
        logger.info('[tom] cifraKey via busca recursiva → %r', val)
        if isinstance(val, str) and _TOM_RE.match(val):
            return val
    except Exception as e:
        logger.warning('[tom] erro ao parsear __NEXT_DATA__: %s', e)
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

    _candidates = [
        ('next_data',     _tom_from_next_data(html)),
        ('url_param',     _match(source_url, r"[?&]tom=([A-G][b#]?m?)")),
        ('data-cifra-key',_match(html, r'data-cifra-key="([A-G][b#]?m?)"')),
        ('data-key',      _match(html, r'data-key="([A-G][b#]?m?)"')),
        ('json_cifraKey', _match(html, r'"cifraKey"\s*:\s*"([A-G][b#]?m?)"')),
        ('json_tom',      _match(html, r'"tom"\s*:\s*"([A-G][b#]?m?)"')),
        ('html_tom_param',_match(html, r'[?&]tom=([A-G][b#]?m?)["&\s]')),
        ('active_href1',  _match(html, r'<a[^>]*href="[^"]*[?&]tom=([A-G][b#]?m?)"[^>]*class="[^"]*\bactive\b')),
        ('active_href2',  _match(html, r'<a[^>]*class="[^"]*\bactive\b[^"]*"[^>]*href="[^"]*[?&]tom=([A-G][b#]?m?)"')),
    ]
    logger.info('[tom] candidatos: %s', {k: v for k, v in _candidates})

    tom_raw = next((v for _, v in _candidates if v), 'C')
    logger.info('[tom] tom_raw selecionado: %r → normalizado: %r', tom_raw, _normalizar_tom(tom_raw))
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
