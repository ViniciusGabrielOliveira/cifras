export type PartesMissa =
    | 'entrada'
    | 'ato-penitencial'
    | 'gloria'
    | 'salmo'
    | 'ofertorio'
    | 'santo'
    | 'comunhao'
    | 'final';

export type CategoriaLiturgica =
    | 'tempo-comum'
    | 'advento'
    | 'quaresma'
    | 'pascoa'
    | 'festas-liturgicas'
    | 'sem-categoria';

export const PARTES_MISSA_LABELS: Record<PartesMissa, string> = {
    'entrada': 'Entrada',
    'ato-penitencial': 'Ato Penitencial',
    'gloria': 'Glória',
    'salmo': 'Salmo',
    'ofertorio': 'Ofertório',
    'santo': 'Santo',
    'comunhao': 'Comunhão',
    'final': 'Final',
};

export const PARTES_MISSA_ORDER: PartesMissa[] = [
    'entrada', 'ato-penitencial', 'gloria', 'salmo',
    'ofertorio', 'santo', 'comunhao', 'final',
];

export const CATEGORIAS_LABELS: Record<CategoriaLiturgica, string> = {
    'tempo-comum': 'Tempo Comum',
    'advento': 'Advento',
    'quaresma': 'Quaresma',
    'pascoa': 'Páscoa',
    'festas-liturgicas': 'Festas Litúrgicas',
    'sem-categoria': 'Sem Categoria',
};

export interface MusicaLista {
    id: string;           // ID único do item na lista
    cifraId: string;      // ID da cifra no repositório (ex: "harpa-crista-porque-ele-vive")
    nome: string;         // Nome/título da música
    autor: string;        // Autor
    parte: PartesMissa;   // Parte da missa onde toca
    ordem: number;        // Ordem dentro da parte
    trecho?: string;      // Trecho da música retornado pela API
}

export interface Lista {
    id: string;
    titulo: string;
    data?: string;                  // ISO date string "YYYY-MM-DD" (opcional)
    categoria: CategoriaLiturgica;
    musicas: MusicaLista[];
    criadaEm: string;               // ISO timestamp
    atualizadaEm: string;
}

export interface ListasDoDiaResponse {
    listas: Lista[];
    assinaturaExpirada: boolean;
}
