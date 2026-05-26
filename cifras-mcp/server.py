#!/usr/bin/env python3
"""
MCP Server — Catálogo de Músicas Litúrgicas

Claude usa este servidor para popular o Firebase com músicas das partes da missa.
O catálogo.json funciona como checkpoint: registra cada música e seu status,
permitindo pausar e continuar sem perder progresso nem repetir importações.

Tools:
  buscar_no_cifraclub  — busca músicas no CifraClub pelo nome/artista
  salvar_candidato     — adiciona ao catálogo local (verifica duplicatas)
  checar_existente     — verifica se já está no Firebase ou catálogo
  importar_proximo     — importa o próximo pendente para o Firebase
  resumo               — progresso por status e parte da missa
"""

import asyncio
import json
import math
import re
import unicodedata
import urllib.parse
from collections import Counter
from datetime import datetime
from pathlib import Path

import httpx
from curl_cffi.requests import AsyncSession
import firebase_admin
from firebase_admin import credentials, firestore

import mcp.types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

# ── Caminhos ──────────────────────────────────────────────────────────────────

BASE_DIR        = Path(__file__).parent
CATALOGO_PATH   = BASE_DIR / "catalogo.json"
SERVICE_ACCOUNT = BASE_DIR.parent / "service-account.json"

# ── Firebase ──────────────────────────────────────────────────────────────────

_db = None

def get_db():
    global _db
    if _db is None:
        if not firebase_admin._apps:
            cred = credentials.Certificate(str(SERVICE_ACCOUNT))
            firebase_admin.initialize_app(cred)
        _db = firestore.client()
    return _db

# ── Catálogo (estado persistente) ─────────────────────────────────────────────

def ler_catalogo() -> dict:
    if CATALOGO_PATH.exists():
        return json.loads(CATALOGO_PATH.read_text(encoding="utf-8"))
    return {"entradas": []}

def salvar_catalogo(cat: dict):
    CATALOGO_PATH.write_text(
        json.dumps(cat, ensure_ascii=False, indent=2), encoding="utf-8"
    )

# ── Helpers ───────────────────────────────────────────────────────────────────

def normalizar(t: str) -> str:
    return unicodedata.normalize("NFD", t.lower()).encode("ascii", "ignore").decode().strip()

def slugify(t: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", normalizar(t))
    return s.strip("-")[:80]

# ── CifraClub — busca ─────────────────────────────────────────────────────────

SOLR_URL = "https://solr.sscdn.co/cc/c7/"

async def buscar_solr(query: str, limit: int = 8) -> list[dict]:
    async with httpx.AsyncClient(timeout=8) as c:
        r = await c.get(SOLR_URL, params={"q": query, "limit": limit})
        r.raise_for_status()
    docs = r.json().get("response", {}).get("docs", [])
    return [d for d in docs if d.get("tipo") == "2" and d.get("dns") and d.get("url")]

# ── CifraClub — scraping ──────────────────────────────────────────────────────

_TONS = {
    'C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B',
    'Cm','C#m','Dm','Ebm','Em','Fm','F#m','Gm','G#m','Am','Bbm','Bm',
}

def _match(text: str, pat: str):
    m = re.search(pat, text)
    return m.group(1).strip() if m else None

def _parse_html(html: str, source_url: str) -> dict:
    title  = _match(html, r'<h1[^>]*itemprop="name"[^>]*>([^<]+)</h1>') or \
             _match(html, r"<title>\s*([^<\-|–]+?)\s*[-|–]") or ""
    artist = _match(html, r'<h2[^>]*itemprop="byArtist"[^>]*>(?:[\s\S]*?<a[^>]*>)?\s*([^<]+?)\s*</(?:a|h2)>') or ""

    tom_raw = (
        _match(html, r'id="cifra_tom"[^>]*>[\s\S]*?<a[^>]*>\s*([A-G][b#]?m?)\s*</a>')
        or _match(source_url, r"[?&]tom=([A-G][b#]?m?)")
        or _match(html, r'"cifraKey"\s*:\s*"([A-G][b#]?m?)"')
        or "C"
    )
    tom = tom_raw.strip() if tom_raw.strip() in _TONS else "C"

    raw = _match(html, r'<pre[^>]*id="pre_cifra"[^>]*>([\s\S]*?)</pre>') or \
          _match(html, r"<pre[^>]*>([\s\S]*?)</pre>") or ""
    lyrics = re.sub(r"<[^>]+>", "", raw.replace("<b>", "").replace("</b>", ""))
    for e, r2 in [("&amp;","&"),("&lt;","<"),("&gt;",">"),("&nbsp;"," ")]:
        lyrics = lyrics.replace(e, r2)
    return {"title": title.strip(), "artist": artist.strip(), "tom": tom, "lyrics": lyrics.strip()}

async def scrape_cifraclub(url: str) -> dict:
    for ver in ["chrome131", "chrome124", "chrome120"]:
        try:
            async with AsyncSession() as s:
                r = await s.get(url, impersonate=ver,
                                headers={"Accept-Language": "pt-BR,pt;q=0.9"},
                                timeout=15, allow_redirects=True)
                r.raise_for_status()
            return _parse_html(r.text, str(r.url))
        except Exception:
            continue
    raise RuntimeError(f"Não foi possível acessar {url}")

# ── Parser de cifra (equivalente ao parseCifraTexto do TS) ────────────────────

_ACORDE_RE = re.compile(r'^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?[0-9]?(?:/[A-G](?:#|b)?)?$')

def _eh_linha_acordes(linha: str) -> bool:
    tokens = linha.strip().lstrip("(").rstrip(")").split()
    return bool(tokens) and all(_ACORDE_RE.match(t) for t in tokens)

def _inferir_tipo(nome: str) -> str:
    n = normalizar(nome)
    if "tab" in n: return "tab"
    if re.search(r'pre.*(refr|chorus)', n): return "pre-refrao"
    if "refr" in n or "coro" in n or "chorus" in n: return "refrao"
    if "verso" in n or "verse" in n or "estrofe" in n: return "verso"
    if "ponte" in n or "bridge" in n: return "ponte"
    if "intro" in n: return "intro"
    if "solo" in n: return "solo"
    return "outro"

def _parse_acordes(acordes_str: str, letra: str) -> list[dict]:
    return [
        {"acorde": m.group(0), "posicao": m.start()}
        for m in re.finditer(r'\S+', acordes_str)
        if _ACORDE_RE.match(m.group(0))
    ]

def parse_cifra_texto(texto: str) -> list[dict]:
    secoes, secao_atual, acordes_pend, tab_linhas = [], {"tipo":"verso","label":"Verso 1","linhas":[]}, None, []

    def flush():
        nonlocal acordes_pend
        if acordes_pend is not None:
            secao_atual["linhas"].append({"letra": "", "acordes": _parse_acordes(acordes_pend, "")})
            acordes_pend = None

    def push():
        nonlocal tab_linhas
        if secao_atual["tipo"] == "tab":
            txt = "\n".join(tab_linhas).strip()
            if txt: secoes.append({**secao_atual, "tabText": txt, "linhas": []})
            tab_linhas = []
        elif secao_atual["linhas"]:
            secoes.append({k: v for k, v in secao_atual.items()})

    for linha in texto.split("\n"):
        m = re.match(r'^\[(.+?)\]', linha.strip())
        if m:
            flush(); push()
            nome = m.group(1).strip()
            secao_atual.clear()
            secao_atual.update({"tipo": _inferir_tipo(nome), "label": nome, "linhas": []})
            tab_linhas = []
            continue

        if secao_atual["tipo"] == "tab":
            tab_linhas.append(linha)
            continue

        if not linha.strip():
            flush()
            continue

        if _eh_linha_acordes(linha):
            flush()
            acordes_pend = linha.strip()
            continue

        letra = linha.rstrip()
        if acordes_pend is not None:
            secao_atual["linhas"].append({"letra": letra, "acordes": _parse_acordes(acordes_pend, letra)})
            acordes_pend = None
        else:
            secao_atual["linhas"].append({"letra": letra, "acordes": []})

    flush(); push()
    return secoes or [{"tipo":"verso","label":"Verso 1","linhas":[{"letra":"","acordes":[]}]}]

# ── Popularidade ─────────────────────────────────────────────────────────────

def _parse_yt_views(text: str) -> int:
    """Converte '1,2 mi de visualizações', '500K views', '3.4B views' → int.

    Lida com dois formatos numéricos:
      PT:  1.234.567  ou  1,2  (ponto=milhar, vírgula=decimal)
      EN:  1,234,567  ou  3.4  (vírgula=milhar, ponto=decimal)
    """
    t = text.lower()
    multiplier = 1
    if any(x in t for x in ["bi", "bilh", "billion", "b views"]):
        multiplier = 1_000_000_000
    elif any(x in t for x in ["mi de", "mi v", "million", "m views", " m "]):
        multiplier = 1_000_000
    elif any(x in t for x in ["mil", "k views", "k ", "thousand"]):
        multiplier = 1_000

    m = re.search(r"([\d]+(?:[.,]\d+)*)", t)
    if not m:
        return 0
    num = m.group(1)

    last_comma, last_dot = num.rfind(","), num.rfind(".")
    if last_comma > last_dot:
        # PT: vírgula é decimal → remove pontos, troca vírgula por ponto
        num = num.replace(".", "").replace(",", ".")
    elif last_dot > last_comma:
        after_dot = num[last_dot + 1:]
        if len(after_dot) <= 2:
            # EN decimal (ex: "3.4") → remove vírgulas, mantém ponto
            num = num.replace(",", "")
        else:
            # PT milhar (ex: "1.234") → remove pontos e vírgulas
            num = num.replace(".", "").replace(",", "")
    else:
        num = num.replace(",", "").replace(".", "")

    try:
        return int(float(num) * multiplier)
    except ValueError:
        return 0


# Artistas muito genéricos que não ajudam a discriminar a busca
_ARTISTAS_GENERICOS = {
    normalizar(a) for a in [
        "", "cantos litúrgicos", "canto litúrgico", "católicas", "litúrgicas",
        "cantos para missa", "missa", "hinário", "cnbb", "tradicional",
        "canto gregoriano", "canto natalino tradicional", "cantos natalinos",
        "cantos pascais",
    ]
}


def _similaridade(a: str, b: str) -> float:
    """Fração dos tokens de `a` que aparecem em `b` (case/acento insensível)."""
    ta = set(normalizar(a).split())
    tb = set(normalizar(b).split())
    return len(ta & tb) / len(ta) if ta else 0.0


def _extrair_videos_yt(html: str) -> list[tuple[str, int, str]]:
    """
    Extrai pares (título_vídeo, views, raw_text) do ytInitialData embedded na página.
    Estratégia: acha cada viewCountText e busca o "runs"→"text" mais próximo antes dele.
    Retorna até 8 candidatos.
    """
    title_positions = [
        (m.start(), m.group(1))
        for m in re.finditer(
            r'"title"\s*:\s*\{"runs"\s*:\s*\[\{"text"\s*:\s*"([^"]{3,120})"', html
        )
    ]
    view_matches = list(re.finditer(
        r'"viewCountText"\s*:\s*\{"simpleText"\s*:\s*"([^"]+)"', html
    ))

    resultados: list[tuple[str, int, str]] = []
    for vm in view_matches[:8]:
        vraw = vm.group(1)
        views = _parse_yt_views(vraw)
        if views <= 0:
            continue
        # Título mais próximo ANTES deste viewCountText (máx 4 000 chars de distância)
        anteriores = [(pos, txt) for pos, txt in title_positions if pos < vm.start()]
        if not anteriores:
            continue
        _, vtitulo = max(anteriores, key=lambda x: x[0])
        if vm.start() - max(p for p, _ in anteriores) > 4_000:
            continue
        resultados.append((vtitulo, views, vraw))

    return resultados


async def _buscar_youtube_views(titulo: str, artista: str) -> tuple[int, str]:
    """
    Retorna (visualizações, texto_bruto) do vídeo do YouTube mais relevante
    para a música buscada.

    Estratégia:
      1. Monta a query com título entre aspas para forçar correspondência exata.
         • Artista específico: '"titulo" artista'
         • Artista genérico/vazio: '"titulo" missa católica'
      2. Extrai pares (título_vídeo, views) da página.
      3. Pontua cada resultado: similaridade(query, titulo_video) × log(views).
      4. Retorna o de maior pontuação.
    """
    artista_norm = normalizar(artista)
    artista_especifico = artista and artista_norm not in _ARTISTAS_GENERICOS

    # Duas tentativas: 1ª com título entre aspas (precisa), 2ª sem aspas (alcance)
    if artista_especifico:
        queries = [
            (f'"{titulo}" {artista}', artista),
            (f'{titulo} {artista}', artista),
        ]
    else:
        queries = [
            (f'"{titulo}" missa católica', "missa católica"),
            (f'{titulo} missa litúrgica', "missa litúrgica"),
        ]

    for query_str, contexto in queries:
        url = f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(query_str)}"

        for ver in ["chrome131", "chrome124", "chrome120"]:
            try:
                async with AsyncSession() as s:
                    r = await s.get(
                        url, impersonate=ver,
                        headers={"Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"},
                        timeout=14,
                    )

                videos = _extrair_videos_yt(r.text)
                if not videos:
                    continue

                # Filtra vídeos cujo título contenha ao menos 30 % dos tokens buscados
                # → descarta vídeos não relacionados (ex: "Aleluia" de Handel)
                relevantes = [
                    (vw, vraw) for vt, vw, vraw in videos
                    if _similaridade(titulo, vt) >= 0.3
                ]
                if relevantes:
                    return max(relevantes, key=lambda x: x[0])

                # Fallback desta tentativa: primeiro resultado (mais relevante pelo YT)
                _, first_views, first_raw = videos[0]
                if first_views > 0:
                    return first_views, first_raw

            except Exception:
                continue
        # se essa query não retornou nada, tenta a próxima

    return 0, "não encontrado"


def _nota_popularidade(yt_views: int, cifraclub: bool) -> float:
    """
    Nota 0–10 baseada em:
      • YouTube views  (escala log, máx 8.5 pts)
          1 K →  1.5 | 10 K →  3.0 | 100 K →  4.5
          1 M →  6.0 | 10 M →  7.5 | 100 M+ → 8.5
      • CifraClub presente (+1.5 pts)
    """
    yt = max(0.0, min(8.5, (math.log10(max(yt_views, 1)) - 2) * 1.5)) if yt_views > 0 else 0.0
    cc = 1.5 if cifraclub else 0.0
    return round(min(10.0, yt + cc), 1)


def _fmt_views(n: int) -> str:
    if n >= 1_000_000_000:
        return f"{n/1_000_000_000:.1f}B"
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.0f}K"
    return str(n)


# ── MCP Server ────────────────────────────────────────────────────────────────

server = Server("cifras-catalog")

@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="buscar_no_cifraclub",
            description=(
                "Busca músicas no CifraClub pelo título e artista. "
                "Retorna até 6 resultados com nome, artista e URL. "
                "Use para encontrar a URL correta antes de salvar_candidato."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "titulo":  {"type": "string", "description": "Nome da música"},
                    "artista": {"type": "string", "description": "Nome do artista (opcional, ajuda a refinar)"},
                },
                "required": ["titulo"],
            },
        ),
        types.Tool(
            name="salvar_candidato",
            description=(
                "Adiciona uma música ao catálogo local como pendente. "
                "Verifica duplicatas por título+artista normalizado. "
                "Não importa para o Firebase ainda — apenas enfileira."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "titulo":       {"type": "string"},
                    "artista":      {"type": "string"},
                    "partes_missa": {
                        "type": "array", "items": {"type": "string"},
                        "description": "Ex: ['comunhao'], ['entrada'], ['gloria', 'abertura']",
                    },
                    "url": {"type": "string", "description": "URL completa do CifraClub"},
                },
                "required": ["titulo", "artista", "partes_missa", "url"],
            },
        ),
        types.Tool(
            name="checar_existente",
            description=(
                "Verifica se uma música já existe no Firebase (cifras_indice) ou no catálogo local. "
                "Use antes de salvar_candidato para evitar duplicatas."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "titulo":  {"type": "string"},
                    "artista": {"type": "string", "description": "Opcional"},
                },
                "required": ["titulo"],
            },
        ),
        types.Tool(
            name="importar_proximo",
            description=(
                "Pega o próximo candidato pendente do catálogo, faz o scraping do CifraClub, "
                "parseia a cifra e salva no Firebase. Atualiza o status no catálogo. "
                "Chame repetidamente até o catálogo zerar."
            ),
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="resumo",
            description="Mostra o progresso: total, contagem por status (pendente/importado/duplicata/erro) e por parte da missa.",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="avaliar_popularidade",
            description=(
                "Avalia o quanto uma música é conhecida buscando visualizações no YouTube "
                "e verificando presença no CifraClub. Gera uma nota de 0 a 10 com detalhamento. "
                "Se a música existir no catálogo local, salva a nota e os detalhes nela."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "titulo":  {"type": "string", "description": "Nome da música"},
                    "artista": {"type": "string", "description": "Artista/compositor (opcional, melhora a busca)"},
                },
                "required": ["titulo"],
            },
        ),
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    try:
        if name == "buscar_no_cifraclub":   return await _tool_buscar(arguments)
        if name == "salvar_candidato":     return _tool_salvar(arguments)
        if name == "checar_existente":     return _tool_checar(arguments)
        if name == "importar_proximo":     return await _tool_importar()
        if name == "resumo":               return _tool_resumo()
        if name == "avaliar_popularidade": return await _tool_avaliar_popularidade(arguments)
        return [types.TextContent(type="text", text=f"Tool desconhecida: {name}")]
    except Exception as e:
        return [types.TextContent(type="text", text=f"Erro inesperado em {name}: {e}")]

# ── Implementações ────────────────────────────────────────────────────────────

async def _tool_buscar(args: dict) -> list[types.TextContent]:
    titulo  = args["titulo"]
    artista = args.get("artista", "")
    query   = f"{titulo} {artista}".strip()

    docs = await buscar_solr(query)
    if not docs:
        return [types.TextContent(type="text", text="Nenhum resultado encontrado no CifraClub.")]

    linhas = []
    for d in docs[:6]:
        url = f"https://www.cifraclub.com.br/{d['dns']}/{d['url']}/"
        linhas.append(f"• {d.get('txt')} — {d.get('art')}\n  {url}")
    return [types.TextContent(type="text", text="\n\n".join(linhas))]


def _tool_salvar(args: dict) -> list[types.TextContent]:
    titulo  = args["titulo"]
    artista = args["artista"]
    partes  = args["partes_missa"]
    url     = args["url"]

    cat    = ler_catalogo()
    t_norm = normalizar(titulo)
    a_norm = normalizar(artista)

    for e in cat["entradas"]:
        if normalizar(e["titulo"]) == t_norm and normalizar(e["artista"]) == a_norm:
            return [types.TextContent(type="text", text=
                f"Já existe no catálogo: {e['titulo']} — {e['artista']} (status: {e['status']})"
            )]

    cat["entradas"].append({
        "id":          slugify(f"{titulo} {artista}"),
        "titulo":      titulo,
        "artista":     artista,
        "partesMissa": partes,
        "url":         url,
        "status":      "pendente",
        "cifraId":     None,
        "erro":        None,
        "adicionadoEm": datetime.now().isoformat(),
    })
    salvar_catalogo(cat)
    pendentes = sum(1 for e in cat["entradas"] if e["status"] == "pendente")
    return [types.TextContent(type="text", text=
        f"Adicionado: {titulo} — {artista}\n"
        f"Partes: {partes}\n"
        f"Total pendentes agora: {pendentes}"
    )]


def _tool_checar(args: dict) -> list[types.TextContent]:
    titulo  = args["titulo"]
    artista = args.get("artista", "")
    t_norm  = normalizar(titulo)
    a_norm  = normalizar(artista)
    achados = []

    # Catálogo local
    for e in ler_catalogo()["entradas"]:
        if normalizar(e["titulo"]) == t_norm:
            if not a_norm or normalizar(e["artista"]) == a_norm:
                achados.append(f"[catálogo] {e['titulo']} — {e['artista']} (status: {e['status']})")

    # Firebase
    try:
        for doc in get_db().collection("cifras_indice").stream():
            d = doc.to_dict()
            if normalizar(d.get("titulo", "")) == t_norm:
                if not a_norm or normalizar(d.get("autor", "")) == a_norm:
                    achados.append(f"[firebase] {d.get('titulo')} — {d.get('autor')} (id: {doc.id})")
    except Exception as e:
        achados.append(f"[erro firebase] {e}")

    if not achados:
        return [types.TextContent(type="text", text="Não encontrado. Pode adicionar ao catálogo.")]
    return [types.TextContent(type="text", text="\n".join(achados))]


async def _tool_importar() -> list[types.TextContent]:
    cat      = ler_catalogo()
    pendente = next((e for e in cat["entradas"] if e["status"] == "pendente"), None)

    if not pendente:
        return [types.TextContent(type="text", text="Nenhum pendente. Catálogo concluído!")]

    try:
        dados   = await scrape_cifraclub(pendente["url"])
        titulo  = dados["title"]  or pendente["titulo"]
        artista = dados["artist"] or pendente["artista"]
        cid     = slugify(f"{titulo} {artista}")
        secoes  = parse_cifra_texto(dados["lyrics"])

        # Verificar duplicata no Firebase por título+artista
        db = get_db()
        for doc in db.collection("cifras_indice").stream():
            d = doc.to_dict()
            if (normalizar(d.get("titulo","")) == normalizar(titulo) and
                normalizar(d.get("autor",""))  == normalizar(artista)):
                pendente["status"]  = "duplicata"
                pendente["cifraId"] = doc.id
                salvar_catalogo(cat)
                return [types.TextContent(type="text", text=
                    f"Duplicata: '{titulo}' já existe no Firebase como '{doc.id}'. Marcado."
                )]

        cifra = {
            "id":         cid,
            "titulo":     titulo,
            "artista":    artista,
            "tom":        dados["tom"],
            "instrumento": "violao",
            "dificuldade": "basico",
            "composicao":  "",
            "categorias":  [],
            "partesMissa": pendente["partesMissa"],
            "secoes":      secoes,
            "sourceUrl":   pendente["url"],
        }

        db.collection("cifras").document(cid).set(cifra)

        letra_txt = " ".join(
            l.get("letra", "")
            for s in secoes if s.get("tipo") != "tab"
            for l in s.get("linhas", [])
        )[:3000]
        db.collection("cifras_indice").document(cid).set({
            "titulo":      titulo,
            "autor":       artista,
            "letra":       letra_txt,
            "categorias":  cifra.get("categorias", []),
            "partesMissa": cifra.get("partesMissa", []),
        })

        pendente["status"]  = "importado"
        pendente["cifraId"] = cid
        salvar_catalogo(cat)

        restantes = sum(1 for e in cat["entradas"] if e["status"] == "pendente")
        return [types.TextContent(type="text", text=
            f"✓ {titulo} — {artista}\n"
            f"  Tom: {dados['tom']} | Seções: {len(secoes)} | ID: {cid}\n"
            f"  Partes: {pendente['partesMissa']}\n"
            f"  Restantes: {restantes} pendentes"
        )]

    except Exception as e:
        pendente["status"] = "erro"
        pendente["erro"]   = str(e)
        salvar_catalogo(cat)
        return [types.TextContent(type="text", text=
            f"Erro ao importar '{pendente['titulo']}': {e}\n"
            f"Marcado como erro. Use importar_proximo para continuar com o próximo."
        )]


async def _tool_avaliar_popularidade(args: dict) -> list[types.TextContent]:
    titulo  = args["titulo"]
    artista = args.get("artista", "")

    # 1. YouTube — visualizações do vídeo mais relevante
    yt_views, yt_raw = await _buscar_youtube_views(titulo, artista)

    # 2. CifraClub — presença via SOLR
    try:
        docs = await buscar_solr(f"{titulo} {artista}".strip(), limit=3)
        cc_presente = bool(docs)
        cc_url = f"https://www.cifraclub.com.br/{docs[0]['dns']}/{docs[0]['url']}/" if docs else ""
    except Exception:
        cc_presente, cc_url = False, ""

    # 3. Nota
    nota = _nota_popularidade(yt_views, cc_presente)

    # 4. Persiste nota no catálogo, se a música já estiver nele
    cat      = ler_catalogo()
    t_norm   = normalizar(titulo)
    a_norm   = normalizar(artista)
    salvou   = False
    for e in cat["entradas"]:
        if normalizar(e["titulo"]) == t_norm and (not a_norm or normalizar(e["artista"]) == a_norm):
            e["nota"] = nota
            e["nota_detalhe"] = {
                "youtube_views": yt_views,
                "youtube_texto": yt_raw,
                "cifraclub":     cc_presente,
            }
            salvou = True
    if salvou:
        salvar_catalogo(cat)

    # 5. Formata saída
    barra = "█" * int(nota) + "░" * (10 - int(nota))
    linhas = [
        f"📊  {titulo}" + (f" — {artista}" if artista else ""),
        "",
        f"  Nota:       {nota:>4} / 10   [{barra}]",
        "",
        f"  YouTube:    {_fmt_views(yt_views):>6} views   ('{yt_raw}')",
        f"  CifraClub:  {'✓  ' + cc_url if cc_presente else '✗  não encontrado'}",
        "",
    ]

    # Interpretação textual
    if nota >= 8:
        linhas.append("  → Música muito conhecida, repertório clássico.")
    elif nota >= 5:
        linhas.append("  → Música moderadamente conhecida.")
    elif nota >= 2:
        linhas.append("  → Música pouco conhecida ou regional.")
    else:
        linhas.append("  → Música muito obscura ou sem presença digital.")

    if salvou:
        linhas.append("  → Nota salva no catálogo local.")

    return [types.TextContent(type="text", text="\n".join(linhas))]


def _tool_resumo() -> list[types.TextContent]:
    entradas = ler_catalogo()["entradas"]
    if not entradas:
        return [types.TextContent(type="text", text="Catálogo vazio. Comece adicionando candidatos com salvar_candidato.")]

    status_ct = Counter(e["status"] for e in entradas)
    partes_ct = Counter(p for e in entradas for p in e.get("partesMissa", []))

    linhas = [
        f"Total: {len(entradas)} músicas no catálogo",
        "",
        "Por status:",
        *[f"  {s:12} {n:3}  {'█' * n}" for s, n in sorted(status_ct.items())],
        "",
        "Por parte da missa:",
        *[f"  {p:20} {n}" for p, n in sorted(partes_ct.items(), key=lambda x: -x[1])],
    ]
    return [types.TextContent(type="text", text="\n".join(linhas))]


# ── Entry point ───────────────────────────────────────────────────────────────

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
