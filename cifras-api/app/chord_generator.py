"""Geração determinística de posições em EADGBE e DGBD, sem serviços de IA."""
import re
from functools import lru_cache
from itertools import product

VERSION = 1
TUNINGS = {"violao": (40, 45, 50, 55, 59, 64), "cavaco": (62, 67, 71, 74)}
NOTES = dict(zip("CDEFGAB", (0, 2, 4, 5, 7, 9, 11)))
FORMULAS = {
    "": [0, 4, 7], "m": [0, 3, 7], "dim": [0, 3, 6], "dim7": [0, 3, 6, 9],
    "aug": [0, 4, 8], "sus2": [0, 2, 7], "sus4": [0, 5, 7], "5": [0, 7],
    "6": [0, 4, 7, 9], "m6": [0, 3, 7, 9], "7": [0, 4, 7, 10],
    "m7": [0, 3, 7, 10], "maj7": [0, 4, 7, 11], "mmaj7": [0, 3, 7, 11],
    "9": [0, 4, 7, 10, 2], "m9": [0, 3, 7, 10, 2], "maj9": [0, 4, 7, 11, 2],
    "11": [0, 4, 10, 5], "m11": [0, 3, 10, 5],
    "13": [0, 4, 10, 9], "m13": [0, 3, 10, 9], "maj13": [0, 4, 11, 9],
    "add9": [0, 4, 7, 2], "madd9": [0, 3, 7, 2],
    "6/9": [0, 4, 9, 2], "m6/9": [0, 3, 9, 2],
    "7sus4": [0, 5, 7, 10], "7sus2": [0, 2, 7, 10],
}
DEGREES = {"2": 2, "4": 5, "5": 7, "6": 9, "7": 10, "9": 2, "11": 5, "13": 9}


def normalize(name):
    return name.strip().replace("♯", "#").replace("♭", "b").replace("−", "-")


def note(name):
    return (NOTES[name[0]] + {"#": 1, "b": -1}.get(name[1:], 0)) % 12


def analyze(name, instrument="violao"):
    match = re.fullmatch(r"([A-G][#b]?)(.*?)(?:/([A-G][#b]?))?", normalize(name))
    if not match:
        return None
    root, suffix, bass = match.groups()
    depth = 0
    for char in suffix:
        depth += (char == "(") - (char == ")")
        if depth < 0 or depth > 1:
            return None
    if depth:
        return None
    suffix = suffix.replace("min", "m").replace("°", "dim").replace("º", "dim").replace("ø", "m7(b5)")
    suffix = re.sub(r"M(7|9|13)", r"maj\1", suffix)
    suffix = re.sub(r"(7|9|13)M", r"maj\1", suffix)
    suffix = re.sub(r"7\+(?=$|\()", "maj7", suffix)
    suffix = {"M": "", "+": "aug", "5+": "aug", "sus": "sus4"}.get(suffix, suffix)
    base = next(k for k in sorted(FORMULAS, key=len, reverse=True) if suffix.startswith(k))
    intervals = set(FORMULAS[base])
    rest = suffix[len(base):].replace("(", "").replace(")", "")
    while rest:
        rest = rest.lstrip("/,")
        if not rest:
            return None
        change = re.match(r"(add|sus)?([#b]?)(13|11|9|7|6|5|4|2)([+-]?)(?:[,/])?", rest)
        if not change:
            return None
        kind, before, degree, after = change.groups()
        if before and after:
            return None
        delta = -1 if before == "b" or after == "-" else 1 if before == "#" or after == "+" else 0
        natural = DEGREES[degree]
        if kind == "sus" or (degree == "4" and not delta):
            intervals -= {3, 4}
        if delta:
            intervals.discard(natural)
        intervals.add((natural + delta) % 12)
        rest = rest[change.end():]
    root_note = note(root)
    bass_note = note(bass) if bass else None
    pitches = {(root_note + i) % 12 for i in intervals}
    if bass_note is not None:
        pitches.add(bass_note)
    # A quinta justa pode ser omitida em extensões; nunca se omite uma alteração.
    if instrument == "cavaco" and len(pitches) > 4 and bass_note != (root_note + 7) % 12:
        pitches.discard((root_note + 7) % 12)
    if len(pitches) > len(TUNINGS[instrument]):
        return None
    return pitches, bass_note


@lru_cache(maxsize=2048)
def generate(name, instrument):
    parsed = analyze(name, instrument)
    if not parsed:
        return []
    required, bass = parsed
    tuning = TUNINGS[instrument]
    count = len(tuning)
    positions = {}
    blocks = [(0, 3)] if count == 4 else [(first, last) for first in range(3) for last in range(3, 6) if last - first + 1 >= max(3, len(required))]
    for base in range(1, 14):
        choices = [[f for f in ([0] if base <= 3 else []) + list(range(base, base + 4)) if (pitch + f) % 12 in required] for pitch in tuning]
        for first, last in blocks:
            for played in product(*choices[first:last + 1]):
                held = [f for f in played if f > 0]
                if held and max(held) - min(held) > 3:
                    continue
                sounds = [tuning[first + i] + fret for i, fret in enumerate(played)]
                if set(s % 12 for s in sounds) != required:
                    continue
                if bass is not None and min(sounds) % 12 != bass:
                    continue
                # Aceita quatro dedos, ou uma pestana contínua + até três dedos.
                barre = None
                if len(held) > 4:
                    low = min(held)
                    at_low = [i for i, f in enumerate(played) if f == low]
                    if len(at_low) < 2 or any(f < low for f in played[at_low[0]:at_low[-1] + 1]):
                        continue
                    if 1 + sum(f > low for f in played) > 4:
                        continue
                    barre = (low, count - (first + at_low[0]), count - (first + at_low[-1]))
                frets = (-1,) * first + played + (-1,) * (count - last - 1)
                score = max(played) * 3 + (max(held) - min(held) if held else 0) * 2 + len(held) + (count - len(played)) * 2
                positions[frets] = (score, barre)
    diagrams = []
    for frets, (_, barre) in sorted(positions.items(), key=lambda item: item[1][0]):
        diagram = {
            "nome": name, "variacao": f"Gerada {len(diagrams) + 1}",
            "casaBase": 1 if max(frets) <= 5 else min(f for f in frets if f > 0),
            "dedos": [{"corda": count - i, "casa": f} for i, f in enumerate(frets) if f > 0],
            "cordasMutadas": [count - i for i, f in enumerate(frets) if f < 0],
            "cordasSoltas": [count - i for i, f in enumerate(frets) if f == 0],
        }
        if barre:
            diagram.update(pestana=barre[0], pestanaInicio=barre[1], pestanaFim=barre[2])
        diagrams.append(diagram)
        if len(diagrams) >= 6:
            break
    return diagrams


def signature(diagram):
    return (tuple(sorted((d["corda"], d["casa"]) for d in diagram.get("dedos", []))), tuple(sorted(diagram.get("cordasMutadas", []))), tuple(sorted(diagram.get("cordasSoltas", []))))


def enrich(data, name):
    """Preserva posições existentes e adiciona somente desenhos diferentes."""
    result = dict(data)
    for instrument, field in (("violao", "variacoes"), ("cavaco", "variacoesCavaco")):
        existing = list(data.get(field, []))
        seen = {signature(d) for d in existing}
        for diagram in generate(name, instrument):
            if signature(diagram) not in seen:
                diagram = dict(diagram, variacao=f"Posição {len(existing) + 1}")
                existing.append(diagram)
                seen.add(signature(diagram))
        result[field] = existing
    result.update(nome=name, geradorVersao=VERSION)
    missing = [i for i, f in (("violao", "variacoes"), ("cavaco", "variacoesCavaco")) if not result[f]]
    result["geracao"] = {"status": "revisao" if missing else "completo", "instrumentosPendentes": missing}
    return result


def ensure_chord(db, name):
    """Transação curta evita perder variações adicionadas por outro usuário."""
    from firebase_admin import firestore
    ref = db.collection("acordes").document(name.replace("/", "_"))
    # Aquecer o cache fora da transação: nenhuma busca de posições mantém lock.
    generate(name, "violao")
    generate(name, "cavaco")

    @firestore.transactional
    def update(transaction):
        snapshot = ref.get(transaction=transaction)
        data = snapshot.to_dict() or {}
        if data.get("geradorVersao") == VERSION and ((data.get("variacoes") and data.get("variacoesCavaco")) or data.get("geracao", {}).get("status") == "revisao"):
            return data
        result = enrich(data, name)
        transaction.set(ref, result, merge=True)
        return result

    return update(db.transaction())
