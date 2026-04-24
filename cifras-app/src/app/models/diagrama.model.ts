export interface Dedo {
    corda: number; // 1=Mi grave ... 6=Mi agudo
    casa: number;  // 0=solta, 1-5=casas
}

export interface DiagramaAcorde {
    nome: string;
    variacao: string;
    casaBase: number;
    pestana?: number;
    dedos: Dedo[];
    cordasMutadas: number[];
    cordasSoltas: number[];
}
