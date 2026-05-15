"""
Base estática de diagramas de violão.
Chave = nome do acorde. Valor = lista de variações (mesmo formato do Firestore).
"""

CHORDS_DB: dict[str, list[dict]] = {
    "C":     [{"nome": "C",     "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 5, "casa": 3}, {"corda": 4, "casa": 2}, {"corda": 2, "casa": 1}], "cordasMutadas": [6], "cordasSoltas": [1, 3]}],
    "Cm":    [{"nome": "Cm",    "variacao": "Pestana 3ª",   "casaBase": 3, "pestana": 3, "dedos": [{"corda": 4, "casa": 5}, {"corda": 3, "casa": 5}, {"corda": 2, "casa": 4}, {"corda": 1, "casa": 3}, {"corda": 5, "casa": 3}], "cordasMutadas": [6], "cordasSoltas": []}],
    "C7":    [{"nome": "C7",    "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 5, "casa": 3}, {"corda": 4, "casa": 2}, {"corda": 3, "casa": 3}, {"corda": 2, "casa": 1}], "cordasMutadas": [6], "cordasSoltas": [1]}],
    "C#m":   [{"nome": "C#m",   "variacao": "Pestana 4ª",   "casaBase": 4, "pestana": 4, "dedos": [{"corda": 4, "casa": 6}, {"corda": 3, "casa": 6}, {"corda": 2, "casa": 5}, {"corda": 1, "casa": 4}, {"corda": 5, "casa": 4}], "cordasMutadas": [6], "cordasSoltas": []}],
    "D":     [{"nome": "D",     "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 3, "casa": 2}, {"corda": 2, "casa": 3}, {"corda": 1, "casa": 2}], "cordasMutadas": [5, 6], "cordasSoltas": [4]}],
    "Dm":    [{"nome": "Dm",    "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 3, "casa": 2}, {"corda": 2, "casa": 3}, {"corda": 1, "casa": 1}], "cordasMutadas": [5, 6], "cordasSoltas": [4]}],
    "D7":    [{"nome": "D7",    "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 3, "casa": 2}, {"corda": 2, "casa": 1}, {"corda": 1, "casa": 2}], "cordasMutadas": [5, 6], "cordasSoltas": [4]}],
    "E":     [{"nome": "E",     "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 5, "casa": 2}, {"corda": 4, "casa": 2}, {"corda": 3, "casa": 1}], "cordasMutadas": [], "cordasSoltas": [1, 2, 6]}],
    "Em":    [{"nome": "Em",    "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 5, "casa": 2}, {"corda": 4, "casa": 2}], "cordasMutadas": [], "cordasSoltas": [1, 2, 3, 6]}],
    "E7":    [{"nome": "E7",    "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 5, "casa": 2}, {"corda": 3, "casa": 1}], "cordasMutadas": [], "cordasSoltas": [1, 2, 4, 6]}],
    "Eb":    [{"nome": "Eb",    "variacao": "Posição 1",   "casaBase": 1, "dedos": [{"corda": 4, "casa": 1}, {"corda": 3, "casa": 3}, {"corda": 2, "casa": 4}, {"corda": 1, "casa": 3}], "cordasMutadas": [5, 6], "cordasSoltas": []}],
    "F":     [{"nome": "F",     "variacao": "Pestana 1ª",  "casaBase": 1, "pestana": 1, "dedos": [{"corda": 5, "casa": 3}, {"corda": 4, "casa": 3}, {"corda": 3, "casa": 2}, {"corda": 1, "casa": 1}, {"corda": 2, "casa": 1}, {"corda": 6, "casa": 1}], "cordasMutadas": [], "cordasSoltas": []}],
    "Fm":    [{"nome": "Fm",    "variacao": "Pestana 1ª",  "casaBase": 1, "pestana": 1, "dedos": [{"corda": 5, "casa": 3}, {"corda": 4, "casa": 3}, {"corda": 1, "casa": 1}, {"corda": 2, "casa": 1}, {"corda": 3, "casa": 1}, {"corda": 6, "casa": 1}], "cordasMutadas": [], "cordasSoltas": []}],
    "F7":    [{"nome": "F7",    "variacao": "Pestana 1ª",  "casaBase": 1, "pestana": 1, "dedos": [{"corda": 5, "casa": 3}, {"corda": 3, "casa": 2}, {"corda": 1, "casa": 1}, {"corda": 2, "casa": 1}, {"corda": 4, "casa": 1}, {"corda": 6, "casa": 1}], "cordasMutadas": [], "cordasSoltas": []}],
    "F#m":   [{"nome": "F#m",   "variacao": "Pestana 2ª",  "casaBase": 2, "pestana": 2, "dedos": [{"corda": 5, "casa": 4}, {"corda": 4, "casa": 4}, {"corda": 1, "casa": 2}, {"corda": 2, "casa": 2}, {"corda": 3, "casa": 2}, {"corda": 6, "casa": 2}], "cordasMutadas": [], "cordasSoltas": []}],
    "G":     [{"nome": "G",     "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 6, "casa": 3}, {"corda": 5, "casa": 2}, {"corda": 1, "casa": 3}], "cordasMutadas": [], "cordasSoltas": [2, 3, 4]}],
    "Gm":    [{"nome": "Gm",    "variacao": "Pestana 3ª",  "casaBase": 3, "pestana": 3, "dedos": [{"corda": 5, "casa": 5}, {"corda": 4, "casa": 5}, {"corda": 1, "casa": 3}, {"corda": 2, "casa": 3}, {"corda": 3, "casa": 3}, {"corda": 6, "casa": 3}], "cordasMutadas": [], "cordasSoltas": []}],
    "G7":    [{"nome": "G7",    "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 6, "casa": 3}, {"corda": 5, "casa": 2}, {"corda": 1, "casa": 1}], "cordasMutadas": [], "cordasSoltas": [2, 3, 4]}],
    "A":     [{"nome": "A",     "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 4, "casa": 2}, {"corda": 3, "casa": 2}, {"corda": 2, "casa": 2}], "cordasMutadas": [6], "cordasSoltas": [1, 5]}],
    "Am":    [{"nome": "Am",    "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 4, "casa": 2}, {"corda": 3, "casa": 2}, {"corda": 2, "casa": 1}], "cordasMutadas": [6], "cordasSoltas": [1, 5]}],
    "A7":    [{"nome": "A7",    "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 4, "casa": 2}, {"corda": 2, "casa": 2}], "cordasMutadas": [6], "cordasSoltas": [1, 3, 5]}],
    "Am7":   [{"nome": "Am7",   "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 4, "casa": 2}, {"corda": 2, "casa": 1}], "cordasMutadas": [6], "cordasSoltas": [1, 3, 5]}],
    "A9":    [{"nome": "A9",    "variacao": "Posição 1",   "casaBase": 1, "dedos": [{"corda": 4, "casa": 2}, {"corda": 3, "casa": 2}, {"corda": 2, "casa": 2}], "cordasMutadas": [], "cordasSoltas": [1, 5, 6]}],
    "B":     [{"nome": "B",     "variacao": "Pestana 2ª",  "casaBase": 2, "pestana": 2, "dedos": [{"corda": 4, "casa": 4}, {"corda": 3, "casa": 4}, {"corda": 2, "casa": 4}, {"corda": 1, "casa": 2}, {"corda": 5, "casa": 2}], "cordasMutadas": [6], "cordasSoltas": []}],
    "Bm":    [{"nome": "Bm",    "variacao": "Pestana 2ª",  "casaBase": 2, "pestana": 2, "dedos": [{"corda": 4, "casa": 4}, {"corda": 3, "casa": 4}, {"corda": 2, "casa": 3}, {"corda": 1, "casa": 2}, {"corda": 5, "casa": 2}], "cordasMutadas": [6], "cordasSoltas": []}],
    "B7":    [{"nome": "B7",    "variacao": "Aberta",      "casaBase": 1, "dedos": [{"corda": 5, "casa": 2}, {"corda": 4, "casa": 1}, {"corda": 3, "casa": 2}, {"corda": 1, "casa": 2}], "cordasMutadas": [6], "cordasSoltas": [2]}],
    "Bb":    [{"nome": "Bb",    "variacao": "Pestana 1ª",  "casaBase": 1, "pestana": 1, "dedos": [{"corda": 4, "casa": 3}, {"corda": 3, "casa": 3}, {"corda": 2, "casa": 3}, {"corda": 1, "casa": 1}, {"corda": 5, "casa": 1}], "cordasMutadas": [6], "cordasSoltas": []}],
    "A9/C#": [{"nome": "A9/C#", "variacao": "Posição 1",   "casaBase": 1, "dedos": [{"corda": 5, "casa": 4}, {"corda": 4, "casa": 2}, {"corda": 3, "casa": 2}, {"corda": 2, "casa": 2}], "cordasMutadas": [6], "cordasSoltas": [1]}],
    "E/G#":  [{"nome": "E/G#",  "variacao": "Posição 1",   "casaBase": 1, "dedos": [{"corda": 6, "casa": 4}, {"corda": 5, "casa": 2}, {"corda": 4, "casa": 2}, {"corda": 3, "casa": 1}], "cordasMutadas": [], "cordasSoltas": [1, 2]}],
}
