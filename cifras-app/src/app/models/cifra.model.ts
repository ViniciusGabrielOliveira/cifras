export type Instrumento = 'violao' | 'guitarra' | 'cavaco' | 'ukulele';
export type Dificuldade = 'iniciante' | 'basico' | 'intermediario' | 'avancado';
export type TipoSecao = 'intro' | 'verso' | 'pre-refrao' | 'refrao' | 'ponte' | 'outro' | 'solo';

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
}

export interface Cifra {
  id: string;
  titulo: string;
  artista: string;
  tom: string;
  instrumento: Instrumento;
  dificuldade: Dificuldade;
  composicao: string;
  secoes: Secao[];
}
