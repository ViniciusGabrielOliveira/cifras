#!/usr/bin/env python3
"""
Avalia a popularidade de todas as músicas em musicas_entrada.json.
Salva progresso após cada música — pode ser interrompido e retomado.

Uso:
    .venv/bin/python3 avaliar_todas.py
    .venv/bin/python3 avaliar_todas.py --concorrencia 4   # default: 4
    .venv/bin/python3 avaliar_todas.py --resetar          # apaga notas existentes
"""

import asyncio
import json
import sys
import time
from pathlib import Path

# Importa helpers do servidor MCP
sys.path.insert(0, str(Path(__file__).parent))
from server import (
    _buscar_youtube_views,
    _nota_popularidade,
    buscar_solr,
    normalizar,
)

ARQUIVO = Path(__file__).parent / "musicas_entrada.json"  # sobrescrito por --arquivo
CONCORRENCIA = 4          # buscas simultâneas no YouTube
PAUSA_ENTRE_LOTES = 2.0   # segundos entre lotes (evita rate-limit)


def carregar() -> list[dict]:
    return json.loads(ARQUIVO.read_text(encoding="utf-8"))


def salvar(data: list[dict]):
    ARQUIVO.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


async def avaliar_uma(musica: dict) -> dict:
    titulo  = musica["titulo"]
    artista = musica.get("artista", "")

    yt_views, yt_raw = await _buscar_youtube_views(titulo, artista)

    try:
        docs = await buscar_solr(f"{titulo} {artista}".strip(), limit=3)
        cc = bool(docs)
    except Exception:
        cc = False

    nota = _nota_popularidade(yt_views, cc)

    musica["nota"] = nota
    musica["nota_detalhe"] = {
        "youtube_views": yt_views,
        "youtube_texto": yt_raw,
        "cifraclub":     cc,
    }
    return musica


async def main(concorrencia: int, resetar: bool):
    data = carregar()

    if resetar:
        for m in data:
            m.pop("nota", None)
            m.pop("nota_detalhe", None)
        salvar(data)
        print("Notas apagadas. Reiniciando.")

    pendentes = [i for i, m in enumerate(data) if "nota" not in m]
    total     = len(data)
    feitos    = total - len(pendentes)

    print(f"Total: {total}  |  já avaliados: {feitos}  |  pendentes: {len(pendentes)}")
    if not pendentes:
        print("Nada a fazer.")
        return

    sem = asyncio.Semaphore(concorrencia)
    t0  = time.monotonic()

    async def processar(idx: int, i: int):
        async with sem:
            m = await avaliar_uma(data[i])
            data[i] = m
            elapsed = time.monotonic() - t0
            vel     = (idx + 1) / elapsed
            restam  = len(pendentes) - idx - 1
            eta     = restam / vel if vel > 0 else 0

            views_fmt = _fmt_views(m["nota_detalhe"]["youtube_views"])
            cc_icon   = "✓" if m["nota_detalhe"]["cifraclub"] else "✗"
            print(
                f"[{feitos + idx + 1:>3}/{total}] "
                f"nota={m['nota']:>4}  yt={views_fmt:>7}  cc={cc_icon}  "
                f"ETA {int(eta//60)}m{int(eta%60):02d}s  "
                f"— {m['titulo'][:45]}"
            )

    # Processa em lotes para salvar progresso frequentemente
    LOTE = concorrencia * 3
    for inicio in range(0, len(pendentes), LOTE):
        lote = pendentes[inicio : inicio + LOTE]
        await asyncio.gather(*[processar(inicio + j, i) for j, i in enumerate(lote)])
        salvar(data)
        if inicio + LOTE < len(pendentes):
            await asyncio.sleep(PAUSA_ENTRE_LOTES)

    # Resumo final
    notas = sorted([m["nota"] for m in data if "nota" in m])
    avaliados = len(notas)
    print(f"\n{'='*60}")
    print(f"Concluído: {avaliados}/{total} músicas avaliadas")
    print(f"Distribuição de notas:")
    faixas = [(0,2,"0-2 muito obscura"), (2,4,"2-4 pouco conhecida"),
              (4,6,"4-6 moderada"), (6,8,"6-8 conhecida"), (8,10.1,"8-10 clássica")]
    for lo, hi, label in faixas:
        count = sum(1 for n in notas if lo <= n < hi)
        bar   = "█" * count
        print(f"  {label:20}  {count:>3}  {bar}")
    print(f"Média: {sum(notas)/len(notas):.1f}  |  Máx: {max(notas)}  |  Mín: {min(notas)}")


def _fmt_views(n: int) -> str:
    if n >= 1_000_000: return f"{n/1_000_000:.1f}M"
    if n >= 1_000:     return f"{n/1_000:.0f}K"
    return str(n)


if __name__ == "__main__":
    conc    = CONCORRENCIA
    resetar = False
    args    = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--resetar":
            resetar = True
        elif args[i] == "--concorrencia" and i + 1 < len(args):
            conc = int(args[i + 1]); i += 1
        elif args[i] == "--arquivo" and i + 1 < len(args):
            ARQUIVO = Path(args[i + 1]); i += 1
        elif args[i].isdigit():
            conc = int(args[i])
        i += 1

    asyncio.run(main(conc, resetar))
