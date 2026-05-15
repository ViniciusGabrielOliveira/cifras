"""
Cifras API — scraper do Cifra Club para uso no app de cifras.

Endpoints:
  GET  /buscar?q=<termo>    Autocomplete de músicas
  GET  /importar?url=<url>  Scrape e parse de uma cifra
  POST /acordes/sync        Cadastra acordes faltantes no Firestore

Autenticação: header  X-API-Key: <API_KEY>
Rate limit:   10 req/min por IP
"""

import asyncio
import base64
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.chords_db import CHORDS_DB
from app.scraper import buscar_sugestoes, importar_cifra

# ── Firebase ──────────────────────────────────────────────────────────────────

_firestore_client = None


def _init_firebase():
    import firebase_admin
    from firebase_admin import credentials
    from firebase_admin import firestore as fb_firestore

    if firebase_admin._apps:
        return fb_firestore.client()

    creds_b64 = os.environ.get("FIREBASE_CREDENTIALS_B64")
    if creds_b64:
        creds_json = json.loads(base64.b64decode(creds_b64).decode())
        cred = credentials.Certificate(creds_json)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app(options={"projectId": "cifras-9c3b7"})

    return fb_firestore.client()


def get_db():
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = _init_firebase()
    return _firestore_client

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
    allow_methods=["GET", "POST"],
    allow_headers=["X-API-Key", "Content-Type"],
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


class AcordesSyncRequest(BaseModel):
    acordes: list[str]


@app.post(
    "/acordes/sync",
    summary="Sincronizar acordes",
    tags=["acordes"],
)
@limiter.limit("30/minute")
async def sync_acordes(
    request: Request,
    body: AcordesSyncRequest,
    _key: str = Security(_require_key),
):
    """
    Recebe uma lista de nomes de acordes, verifica quais ainda não existem
    no Firestore e cadastra os que estão na base estática.
    """
    nomes = list(dict.fromkeys(body.acordes))  # deduplica mantendo ordem

    def _sync():
        db = get_db()
        adicionados, ja_existiam, sem_dados = [], [], []

        for nome in nomes:
            doc_id = nome.replace("/", "_")
            ref = db.collection("acordes").document(doc_id)
            if ref.get().exists:
                ja_existiam.append(nome)
                continue
            if nome in CHORDS_DB:
                ref.set({"variacoes": CHORDS_DB[nome]})
                adicionados.append(nome)
            else:
                sem_dados.append(nome)

        return {"adicionados": adicionados, "ja_existiam": ja_existiam, "sem_dados": sem_dados}

    try:
        return await asyncio.to_thread(_sync)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao acessar Firestore: {exc}") from exc


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}
