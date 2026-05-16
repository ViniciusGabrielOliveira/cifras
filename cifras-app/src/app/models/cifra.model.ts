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
  // Campos de propriedade (undefined = pública, retrocompatível)
  status?: StatusCifra;
  donoUid?: string;
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
