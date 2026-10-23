export interface Liturgia {
  id: string;
  nome: string;
  grupo: string;
}

export interface DiaLiturgico {
  id: string;
  nome: string;
  tempo: string;
  cor: string;
  ciclo: 'A' | 'B' | 'C';
  propria: boolean;
  grau: string;
  opcional: boolean;
}

export interface CatalogoLiturgico {
  primeiroAno: number;
  ultimoAno: number;
  liturgias: Liturgia[];
}

export interface CalendarioLiturgico {
  ano: number;
  fonte: string;
  dias: Record<string, DiaLiturgico[]>;
}

export interface ConfigLiturgia {
  locais: Liturgia[];
  ajustes: Record<string, { liturgiaId: string; nome: string; cor: string; propria: boolean }>;
}
