#!/usr/bin/env python3
"""
Importa em massa as músicas dos arquivos musicas_*.json para o Firebase,
buscando e raspando cifras do CifraClub automaticamente.

Uso:
  .venv/bin/python3 importar_catalogo.py              # processa pendentes
  .venv/bin/python3 importar_catalogo.py --resumo     # mostra estado atual
  .venv/bin/python3 importar_catalogo.py --resetar    # reseta todos para pendente
  .venv/bin/python3 importar_catalogo.py --retry-erros
  .venv/bin/python3 importar_catalogo.py --concorrencia 2

Estados:
  pendente       — aguardando
  importado      — salvo no Firebase
  nao_encontrado — sem cifra compatível no CifraClub
  duplicata      — já existe no Firebase (cifra_id = doc existente)
  erro           — falha de rede/scraping (reprocessável com --retry-erros)
"""

import asyncio
import json
import sys
import unicodedata
import re
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

# ── Caminhos ──────────────────────────────────────────────────────────────────

BASE          = Path(__file__).parent
PROGRESSO     = BASE / "importar_progresso.json"
SERVICE_ACCT  = BASE.parent / "service-account.json"

# ── Importações do projeto ────────────────────────────────────────────────────

sys.path.insert(0, str(BASE))
from server import (
    buscar_solr,
    scrape_cifraclub,
    parse_cifra_texto,
    normalizar,
    slugify,
    get_db,
)
import cache

# ── Configurações ─────────────────────────────────────────────────────────────

CONCORRENCIA_PADRAO = 1        # conservador: scraping com rate-limit
SIM_TITULO_MIN      = 0.70     # similaridade mínima do título
SIM_ARTISTA_MIN     = 0.45     # similaridade mínima do artista

# ── Progresso ─────────────────────────────────────────────────────────────────

def ler_progresso() -> dict:
    if PROGRESSO.exists():
        return json.loads(PROGRESSO.read_text(encoding="utf-8"))
    return {"musicas": []}


def salvar_progresso(prog: dict):
    prog["ultima_atualizacao"] = datetime.now().isoformat()
    PROGRESSO.write_text(json.dumps(prog, ensure_ascii=False, indent=2), encoding="utf-8")


# ── Carga dos JSONs de músicas ─────────────────────────────────────────────────

def carregar_todos_jsons() -> list[dict]:
    """Lê todos os musicas_*.json e retorna lista unificada."""
    musicas = []
    for arq in sorted(BASE.glob("musicas_*.json")):
        try:
            dados = json.loads(arq.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[aviso] Erro ao ler {arq.name}: {e}")
            continue
        for m in dados:
            if isinstance(m, dict) and m.get("titulo") and m.get("artista"):
                musicas.append({**m, "_arquivo": arq.name})
    return musicas


def sincronizar_progresso(prog: dict) -> int:
    """
    Adiciona ao progresso músicas novas dos JSONs (não apaga as existentes).
    Retorna quantas foram adicionadas.
    """
    existentes = {
        (normalizar(m["titulo"]), normalizar(m["artista"]))
        for m in prog["musicas"]
    }
    novas = 0
    for m in carregar_todos_jsons():
        chave = (normalizar(m["titulo"]), normalizar(m["artista"]))
        if chave not in existentes:
            nota_detalhe = m.get("nota_detalhe")
            prog["musicas"].append({
                "titulo":      m["titulo"],
                "artista":     m["artista"],
                "partes_missa": m.get("partes_missa", []),
                "nota":        m.get("nota"),
                "nota_detalhe": nota_detalhe,
                "arquivo":     m["_arquivo"],
                "status":      "pendente",
                "cifra_url":   None,
                "cifra_id":    None,
                "erro":        None,
            })
            existentes.add(chave)
            novas += 1
    return novas


# ── Similaridade ──────────────────────────────────────────────────────────────

def sim(a: str, b: str) -> float:
    return SequenceMatcher(None, normalizar(a), normalizar(b)).ratio()


ARTISTAS_GENERICOS = {
    "cantos liturgicos", "musicas liturgicas", "cnbb", "campanha da fraternidade",
    "catolicas", "canticos para a missa", "coral liturgico",
}


def _artista_generico(artista: str) -> bool:
    return normalizar(artista) in ARTISTAS_GENERICOS


def _pick_melhor(docs: list[dict], titulo: str, artista: str,
                 generico: bool) -> dict | None:
    for doc in docs[:8]:
        t_cc = doc.get("txt", "")
        a_cc = doc.get("art", "")
        st = sim(t_cc, titulo)
        sa = sim(a_cc, artista)
        # Título muito similar + artista razoável
        if st >= SIM_TITULO_MIN and sa >= SIM_ARTISTA_MIN:
            return doc
        # Título quase idêntico — aceita artista genérico ou sem correspondência
        if st >= 0.90:
            return doc
        # Para artistas genéricos, aceita qualquer título bem parecido
        if generico and st >= 0.80:
            return doc
    return None


async def melhor_resultado(titulo: str, artista: str) -> tuple[dict | None, str]:
    """
    Retorna (doc_solr, url) do melhor match, ou (None, "") se não encontrado.
    Estratégia em dois passos:
      1. Busca "{titulo} {artista}" → avalia com limiares normais
      2. Fallback: busca só "{titulo}" → aceita qualquer título ≥ 0.80
    """
    generico = _artista_generico(artista)

    # Passo 1: query completa
    docs = await buscar_solr(f"{titulo} {artista}")
    doc  = _pick_melhor(docs, titulo, artista, generico)

    # Passo 2: fallback só com título (para artistas genéricos ou sem resultado)
    if not doc and (generico or not docs):
        docs2 = await buscar_solr(titulo)
        doc   = _pick_melhor(docs2, titulo, artista, generico=True)

    if not doc:
        return None, ""
    url = f"https://www.cifraclub.com.br/{doc['dns']}/{doc['url']}/"
    return doc, url


# ── Firebase: checagem de duplicata ───────────────────────────────────────────

def checar_duplicata(titulo: str, artista: str) -> str | None:
    """Retorna o cifra_id se já existe no cache local, senão None."""
    return cache.checar(titulo, artista)


# ── Firebase: salvar cifra ────────────────────────────────────────────────────

def salvar_firebase(musica: dict, dados_scrape: dict, cid: str):
    secoes    = parse_cifra_texto(dados_scrape["lyrics"])
    titulo    = dados_scrape["title"]  or musica["titulo"]
    artista   = dados_scrape["artist"] or musica["artista"]

    nota_detalhe_raw = musica.get("nota_detalhe")
    nota_detalhe_fb  = None
    if nota_detalhe_raw:
        nota_detalhe_fb = {
            "youtubeViews": nota_detalhe_raw.get("youtube_views", 0),
            "youtubeTexto": nota_detalhe_raw.get("youtube_texto", ""),
            "cifraclub":    nota_detalhe_raw.get("cifraclub", False),
        }

    cifra_doc = {
        "id":          cid,
        "titulo":      titulo,
        "artista":     artista,
        "tom":         dados_scrape["tom"],
        "instrumento": "violao",
        "dificuldade": "basico",
        "composicao":  "",
        "categorias":  [],
        "partesMissa": musica["partes_missa"],
        "secoes":      secoes,
        "sourceUrl":   musica["cifra_url"],
        "status":      "publica",
    }
    if musica.get("nota") is not None:
        cifra_doc["nota"] = musica["nota"]
    if nota_detalhe_fb:
        cifra_doc["notaDetalhe"] = nota_detalhe_fb

    letra_txt = " ".join(
        l.get("letra", "")
        for s in secoes if s.get("tipo") != "tab"
        for l in s.get("linhas", [])
    )[:3000]

    db = get_db()
    db.collection("cifras").document(cid).set(cifra_doc)
    db.collection("cifras_indice").document(cid).set({
        "titulo":      titulo,
        "autor":       artista,
        "letra":       letra_txt,
        "categorias":  cifra_doc["categorias"],
        "partesMissa": cifra_doc["partesMissa"],
    })
    cache.registrar(db, cid, titulo, artista, cifra_doc["partesMissa"])


# ── Processamento de uma música ───────────────────────────────────────────────

async def processar(musica: dict, sem: asyncio.Semaphore, idx: int, total: int):
    async with sem:
        titulo  = musica["titulo"]
        artista = musica["artista"]
        prefixo = f"[{idx:>4}/{total}]"

        try:
            # 1. Busca no CifraClub (com fallback por título)
            _doc, url = await melhor_resultado(titulo, artista)

            if not _doc:
                musica["status"] = "nao_encontrado"
                print(f"{prefixo} ✗ não encontrado  — {titulo} / {artista}")
                return

            musica["cifra_url"] = url

            # 2. Verifica duplicata no Firebase
            dup_id = checar_duplicata(titulo, artista)
            if dup_id:
                musica["status"]   = "duplicata"
                musica["cifra_id"] = dup_id
                print(f"{prefixo} = duplicata        — {titulo} / {artista}  (id: {dup_id})")
                return

            # 3. Raspa a cifra
            dados = await scrape_cifraclub(url)

            # 4. Salva no Firebase
            cid = slugify(f"{dados['title'] or titulo} {dados['artist'] or artista}")
            salvar_firebase(musica, dados, cid)

            musica["status"]   = "importado"
            musica["cifra_id"] = cid
            nota_str = f"nota={musica['nota']:.1f}" if musica.get("nota") is not None else ""
            print(f"{prefixo} ✓ importado        — {titulo} / {artista}  {nota_str}  (id: {cid})")

        except Exception as e:
            musica["status"] = "erro"
            musica["erro"]   = str(e)
            print(f"{prefixo} ! erro             — {titulo} / {artista}  ({e})")


# ── Resumo ────────────────────────────────────────────────────────────────────

def exibir_resumo(prog: dict):
    musicas  = prog.get("musicas", [])
    total    = len(musicas)
    contagem = {}
    for m in musicas:
        contagem[m["status"]] = contagem.get(m["status"], 0) + 1

    print(f"\n{'─'*55}")
    print(f"  Total catalogado : {total}")
    print(f"  importado        : {contagem.get('importado', 0)}")
    print(f"  pendente         : {contagem.get('pendente', 0)}")
    print(f"  nao_encontrado   : {contagem.get('nao_encontrado', 0)}")
    print(f"  duplicata        : {contagem.get('duplicata', 0)}")
    print(f"  erro             : {contagem.get('erro', 0)}")

    # Por arquivo
    por_arq: dict = {}
    for m in musicas:
        arq = m.get("arquivo", "?")
        if arq not in por_arq:
            por_arq[arq] = {"imp": 0, "nao": 0, "dup": 0, "err": 0, "pen": 0}
        s = m["status"]
        if s == "importado":       por_arq[arq]["imp"] += 1
        elif s == "nao_encontrado": por_arq[arq]["nao"] += 1
        elif s == "duplicata":      por_arq[arq]["dup"] += 1
        elif s == "erro":           por_arq[arq]["err"] += 1
        else:                       por_arq[arq]["pen"] += 1

    print(f"\n  {'Arquivo':<35}  imp  não  dup  err  pen")
    print(f"  {'─'*35}  {'─'*3}  {'─'*3}  {'─'*3}  {'─'*3}  {'─'*3}")
    for arq, c in sorted(por_arq.items()):
        print(f"  {arq:<35}  {c['imp']:>3}  {c['nao']:>3}  {c['dup']:>3}  {c['err']:>3}  {c['pen']:>3}")
    print(f"{'─'*55}\n")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    conc         = CONCORRENCIA_PADRAO
    resetar      = False
    retry_erros  = False
    so_resumo    = False

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--resetar":
            resetar = True
        elif args[i] == "--retry-erros":
            retry_erros = True
        elif args[i] == "--resumo":
            so_resumo = True
        elif args[i] == "--concorrencia" and i + 1 < len(args):
            conc = int(args[i + 1]); i += 1
        elif args[i].lstrip("-").isdigit():
            conc = int(args[i].lstrip("-"))
        i += 1

    prog = ler_progresso()

    # Sincroniza JSONs → progresso (adiciona novas músicas)
    novas = sincronizar_progresso(prog)
    if novas:
        print(f"[sync] {novas} músicas novas adicionadas ao progresso.")
    salvar_progresso(prog)

    if so_resumo:
        exibir_resumo(prog)
        return

    if resetar:
        for m in prog["musicas"]:
            m["status"]    = "pendente"
            m["cifra_url"] = None
            m["cifra_id"]  = None
            m["erro"]      = None
        salvar_progresso(prog)
        print("[resetar] Todas as músicas marcadas como pendente.")

    # Seleciona pendentes (+ erros se --retry-erros)
    status_alvo = {"pendente"}
    if retry_erros:
        status_alvo.add("erro")

    fila = [m for m in prog["musicas"] if m["status"] in status_alvo]
    total_fila = len(fila)

    if not fila:
        print("Nenhuma música pendente. Use --resumo para ver o estado.")
        exibir_resumo(prog)
        return

    print(f"Processando {total_fila} músicas  (concorrência={conc})\n")
    cache.sync(get_db())
    sem     = asyncio.Semaphore(conc)
    total_g = len(prog["musicas"])
    idx_map = {id(m): i + 1 for i, m in enumerate(
        m for m in prog["musicas"] if m["status"] in status_alvo
    )}

    # Processa em lotes para salvar progresso periodicamente
    LOTE = max(conc, 4)
    for inicio in range(0, len(fila), LOTE):
        lote = fila[inicio: inicio + LOTE]
        tarefas = [
            processar(m, sem, inicio + j + 1, total_fila)
            for j, m in enumerate(lote)
        ]
        await asyncio.gather(*tarefas)
        salvar_progresso(prog)

    exibir_resumo(prog)


if __name__ == "__main__":
    asyncio.run(main())
