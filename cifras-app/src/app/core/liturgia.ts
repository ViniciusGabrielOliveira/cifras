import { Lista } from '../models/lista.model';
import { DiaLiturgico } from '../models/liturgia.model';

/** Calendar dates follow the parish timezone, never UTC. */
export function dataLiturgicaHoje(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora);
  const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function listasElegiveis(listas: Lista[], data: string, dia: DiaLiturgico | null): Lista[] {
  const cicloFerial = Number(data.slice(0, 4)) % 2 ? 'I' : 'II';
  const publicas = listas.filter(l => l.tipo !== 'privada' && l.musicas.length > 0 && (!l.ciclosFeriales?.length || l.ciclosFeriales.includes(cicloFerial)));
  const marcadas = publicas.filter(l => l.datasLiturgicas?.includes(data));
  if (marcadas.length) return marcadas;
  // Restrict dated lists to their validity window, including lists linked to a liturgy.
  const validas = publicas.filter(l => (!l.dataInicio || l.dataInicio <= data) && (!l.dataFim || data <= l.dataFim) && (!l.data || l.data === data));
  const especificas = validas.filter(l => (!l.liturgiasIds?.length && !l.todosDias && (l.data === data || !!l.dataInicio || !!l.dataFim)));
  if (especificas.length) return especificas;
  if (!dia) return [];
  const vinculadas = validas.filter(l => !l.ciclosLiturgicos?.length || l.ciclosLiturgicos.includes(dia.ciclo));
  const celebracao = vinculadas.filter(l => l.liturgiasIds?.includes(dia.id));
  if (celebracao.length) {
    const ciclo = celebracao.filter(l => l.ciclosLiturgicos?.includes(dia.ciclo));
    return ciclo.length ? ciclo : celebracao;
  }
  if (dia.propria) return [];
  const feriais = vinculadas.filter(l => !!dia.feriaId && l.liturgiasIds?.includes(dia.feriaId));
  if (feriais.length) return feriais;
  const tempo = vinculadas.filter(l => l.liturgiasIds?.includes(dia.tempo));
  if (tempo.length) return tempo;
  // Existing categorized lists continue working; unclassified "every day" lists
  // do not override a liturgical season or a celebration with its own structure.
  return vinculadas.filter(l => !l.liturgiasIds?.length && l.categoria === dia.tempo);
}

export function escolherSugestao(listas: Lista[], anterior?: string): Lista | undefined {
  const alternativas = listas.filter(l => l.id !== anterior);
  const opcoes = alternativas.length ? alternativas : listas;
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}
