import { Cifra } from '../models/cifra.model';

const NOTAS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

const ENHARMONICOS: Record<string, string> = {
    'Bb': 'A#', 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#',
};

function indexNota(nota: string): number {
    const normalizada = ENHARMONICOS[nota] ?? nota;
    const idx = NOTAS.indexOf(normalizada);
    if (idx === -1) return -1;
    return idx;
}

export function transporNota(nota: string, delta: number): string {
    const idx = indexNota(nota);
    if (idx === -1) return nota;
    const novoIdx = ((idx + delta) % 12 + 12) % 12;
    return NOTAS[novoIdx];
}

const REGEX_ACORDE = /^([A-G](?:#|b)?)([^/]*)(\/([A-G](?:#|b)?))?$/;

export function transporAcorde(acorde: string, delta: number): string {
    const m = acorde.match(REGEX_ACORDE);
    if (!m) return acorde;
    const [, raiz, mod, , baixo] = m;
    return `${transporNota(raiz, delta)}${mod}${baixo ? '/' + transporNota(baixo, delta) : ''}`;
}

export function transporCifra(cifra: Cifra, delta: number): Cifra {
    if (delta === 0) return cifra;
    return {
        ...cifra,
        tom: transporAcorde(cifra.tom, delta),
        secoes: cifra.secoes.map(secao => ({
            ...secao,
            linhas: secao.linhas.map(linha => ({
                ...linha,
                acordes: linha.acordes.map(({ posicao, acorde }) => ({
                    posicao,
                    acorde: transporAcorde(acorde, delta),
                })),
            })),
        })),
    };
}
