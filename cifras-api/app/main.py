"""
Cifras API — scraper do Cifra Club para uso no app de cifras.

Endpoints:
  GET /buscar?q=<termo>    Autocomplete de músicas
  GET /importar?url=<url>  Scrape e parse de uma cifra

Autenticação: header  X-API-Key: <API_KEY>
Rate limit:   10 req/min por IP
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.scraper import buscar_sugestoes, importar_cifra

# ── Configuração ─────────────────────────────────────────────────────────────

API_KEY = os.environ.get("API_KEY", "")
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")]

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

limiter = Limiter(key_func=get_remote_address, default_limits=["10/minute"])


def _require_key(key: str = Security(api_key_header)) -> str:
    if not API_KEY:
        return ""  # key não configurada → modo desenvolvimento sem autenticação
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="API key inválida ou ausente")
    return key


# ── App ──────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not API_KEY:
        import warnings
        warnings.warn("⚠️  API_KEY não configurada — autenticação desabilitada")
    yield


app = FastAPI(
    title="Cifras API",
    description=(
        "API de suporte ao app de cifras. "
        "Faz autocomplete e scraping do Cifra Club."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["X-API-Key"],
)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get(
    "/buscar",
    summary="Autocomplete de músicas",
    response_description="Lista de sugestões do Cifra Club",
    tags=["cifra-club"],
)
@limiter.limit("10/minute")
async def buscar(
    request: Request,
    q: str,
    _key: str = Security(_require_key),
):
    """
    Busca sugestões de músicas na API de autocomplete do Cifra Club.

    - **q**: termo de busca (nome da música ou artista)

    Retorna lista de objetos com `id`, `nome`, `artista`, `dns` e `url`.
    Os campos `dns` e `url` combinados formam o path da cifra:
    `https://www.cifraclub.com.br/{dns}/{url}/`
    """
    if not q or not q.strip():
        raise HTTPException(status_code=422, detail="Parâmetro 'q' não pode ser vazio")

    try:
        return await buscar_sugestoes(q.strip())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao contatar Cifra Club: {exc}") from exc


@app.get(
    "/importar",
    summary="Importar cifra",
    response_description="Dados da música: título, artista, tom e letra com acordes",
    tags=["cifra-club"],
)
@limiter.limit("10/minute")
async def importar(
    request: Request,
    url: str,
    _key: str = Security(_require_key),
):
    """
    Faz o fetch e parse de uma página do Cifra Club.

    - **url**: URL completa da cifra (deve ser do domínio `cifraclub.com.br`)

    Retorna `title`, `artist`, `tom`, `lyricsWithChords` e `sourceUrl`.
    O campo `lyricsWithChords` contém a letra com acordes no formato texto plano
    do Cifra Club (linhas de acordes intercaladas com linhas de letra).
    """
    import re

    if not url or not re.match(r"^https?://(www\.)?cifraclub\.com\.br/", url):
        raise HTTPException(
            status_code=422,
            detail="A URL deve pertencer ao domínio cifraclub.com.br",
        )

    try:
        return await importar_cifra(url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao acessar a página: {exc}") from exc


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}
