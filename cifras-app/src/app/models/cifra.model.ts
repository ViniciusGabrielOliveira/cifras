export type Instrumento = 'violao' | 'guitarra' | 'cavaco' | 'ukulele';
export type Dificuldade = 'iniciante' | 'basico' | 'intermediario' | 'avancado';
export type TipoSecao = 'intro' | 'verso' | 'pre-refrao' | 'refrao' | 'ponte' | 'outro' | 'solo' | 'tab';

export interface AcordeLinha {
  posicao: number;
  acorde: string;
}

export interface LinhaCifra {
  letra: string;
  acordes: AcordeLinha[];
}

export interface Secao {
  tipo: TipoSecao;
  label: string;
  linhas: LinhaCifra[];
  tabText?: string;  // preenchido quando tipo === 'tab'
}

export type StatusCifra = 'publica' | 'privada' | 'pendente_revisao';

export interface NotaDetalhe {
  youtubeViews: number;
  youtubeTexto: string;
  cifraclub: boolean;
}

export interface Cifra {
  id: string;
  titulo: string;
  artista: string;
  tom: string;
  instrumento: Instrumento;
  dificuldade: Dificuldade;
  composicao: string;
  videoLink?: string;
  sourceUrl?: string;
  categorias?: string[];
  partesMissa?: string[];
  secoes: Secao[];
  nota?: number;
  notaDetalhe?: NotaDetalhe;
  // Campos de propriedade (undefined = pública, retrocompatível)
  status?: StatusCifra;
  donoUid?: string;
  // IDs das listas onde esta cifra está adicionada (controle de visibilidade)
  listasIds?: string[];
}

export interface CifraCustom {
  id: string;           // `${uid}_${cifraId}`
  uid: string;
  cifraId: string;
  secoes: Secao[];
  pendente_revisao: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

// ── Versionamento / Pull Requests ─────────────────────────────────────────

export interface CifraVersao {
  id: string;
  titulo: string;
  artista: string;
  tom: string;
  instrumento: Instrumento;
  dificuldade: Dificuldade;
  composicao: string;
  secoes: Secao[];
  aprovadoEm: string;
  autorUid: string;
  autorNome: string;
  motivo?: MotivoVersao;
  motivoCustom?: string;
}

export type MotivoVersao =
  | 'simplificada'
  | 'original_errada'
  | 'tom_diferente'
  | 'arranjo_diferente'
  | 'letra_atualizada'
  | 'outro_instrumento'
  | 'outros';

export const MOTIVOS_VERSAO: Record<MotivoVersao, string> = {
  simplificada:       'Versão simplificada',
  original_errada:    'A original está errada (acorde/letra)',
  tom_diferente:      'Tom diferente',
  arranjo_diferente:  'Arranjo / adaptação diferente',
  letra_atualizada:   'Letra atualizada (relançamento)',
  outro_instrumento:  'Versão para outro instrumento',
  outros:             'Outros',
};

export type TipoPR = 'nova_cifra' | 'nova_versao';
export type StatusPR = 'pendente' | 'aprovado' | 'rejeitado';

export interface CifraPR {
  id: string;
  cifraId: string | null;   // null quando PR de nova cifra
  tipo: TipoPR;
  dados: Omit<Cifra, 'id' | 'listasIds'>; // snapshot completo da cifra submetida
  autorUid: string;
  autorNome: string;
  motivo?: MotivoVersao;
  motivoCustom?: string;
  status: StatusPR;
  criadoEm: string;
  resolvidoEm?: string;
  reviewerUid?: string;
  reviewerNota?: string;
}
