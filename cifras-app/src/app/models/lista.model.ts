export type PartesMissa = string;
export type CategoriaLiturgica = string;

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
