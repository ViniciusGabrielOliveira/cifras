import { Cifra } from '../models/cifra.model';

const NOTAS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

const ENHARMONICOS: Record<string, string> = {
    'Bb': 'A#', 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Cb': 'B',
};

function indexNota(nota: string): number {
    const normalizada = ENHARMONICOS[nota] ?? nota;
    const idx = NOTAS.indexOf(normalizada);
    if (idx === -1) return -1;
    return idx;
}

export function calcularDelta(tomOriginal: string, tomAlvo: string): number {
    const origem = indexNota(tomOriginal.replace(/m$/, ''));
    const alvo   = indexNota(tomAlvo.replace(/m$/, ''));
    if (origem === -1 || alvo === -1) return 0;
    return ((alvo - origem + 12) % 12);
}

export function transporNota(nota: string, delta: number): string {
    const idx = indexNota(nota);
    if (idx === -1) return nota;
    const novoIdx = ((idx + delta) % 12 + 12) % 12;
    return NOTAS[novoIdx];
}

export const REGEX_ACORDE = /^([A-G](?:#|b)?)([^/]*)(\/([A-G](?:#|b)?))?$/;

export function transporAcorde(acorde: string, delta: number): string {
    const m = acorde.match(REGEX_ACORDE);
    if (!m) return acorde;
    const [, raiz, mod, , baixo] = m;
    return `${transporNota(raiz, delta)}${mod}${baixo ? '/' + transporNota(baixo, delta) : ''}`;
}

function reconstruirRawChordsLine(raw: string, acordesOriginais: { posicao: number; acorde: string }[], delta: number): string {
    // Substitui cada acorde no texto original da direita para a esquerda,
    // preservando parênteses, setas e espaços ao redor dos acordes.
    const sorted = [...acordesOriginais].sort((a, b) => b.posicao - a.posicao);
    let result = raw;
    for (const { posicao, acorde } of sorted) {
        const transposto = transporAcorde(acorde, delta);
        result = result.substring(0, posicao) + transposto + result.substring(posicao + acorde.length);
    }
    return result;
}

export function transporCifra(cifra: Cifra, delta: number): Cifra {
    if (delta === 0) return cifra;
    return {
        ...cifra,
        tom: transporAcorde(cifra.tom, delta),
        secoes: cifra.secoes.map(secao => {
            if (secao.tipo === 'tab') return secao;
            return {
                ...secao,
                linhas: secao.linhas.map(linha => {
                    const novosAcordes = linha.acordes.map(({ posicao, acorde }) => ({
                        posicao,
                        acorde: transporAcorde(acorde, delta),
                    }));
                    const novoRaw = linha.rawChordsLine !== undefined
                        ? reconstruirRawChordsLine(linha.rawChordsLine, linha.acordes, delta)
                        : undefined;
                    return { ...linha, acordes: novosAcordes, rawChordsLine: novoRaw };
                }),
            };
        }),
    };
}
