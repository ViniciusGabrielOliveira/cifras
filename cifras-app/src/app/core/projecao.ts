import { Cifra } from '../models/cifra.model';

/** Preserva a ordem e repetições das seções, descartando acordes e tablaturas. */
export function slidesDaCifra(cifra: Cifra): string[] {
  return cifra.secoes.flatMap(secao => {
    if (secao.tipo === 'tab') return [];
    const versos = secao.linhas.map(linha => linha.letra.trim()).join('\n');
    return versos.split(/\n\s*\n/).flatMap(bloco => {
      const linhas = bloco.split('\n').filter(linha => linha.trim());
      const slides: string[] = [];
      for (let i = 0; i < linhas.length; i += 4) {
        slides.push(linhas.slice(i, i + 4).join('\n'));
      }
      return slides;
    });
  });
}
