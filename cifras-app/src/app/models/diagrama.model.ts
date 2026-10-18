export interface Dedo {
    corda: number; // 1=corda mais aguda; 4=cavaco grave, 6=violão grave
    casa: number;  // número absoluto da casa no braço
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
