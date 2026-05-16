export type PartesMissa = string;
export type CategoriaLiturgica = string;
export type TipoLista = 'publica' | 'privada';
export type RoleParticipante = 'editor' | 'visualizador';

export interface Participante {
    uid: string;
    nome: string;
    role: RoleParticipante;
}

export interface MusicaLista {
    id: string;
    cifraId: string;
    nome: string;
    autor: string;
    parte: PartesMissa;
    ordem: number;
    trecho?: string;
    privada?: boolean;   // true se a cifra é privada do dono da lista
}

export interface Lista {
    id: string;
    titulo: string;
    data?: string;
    categoria: CategoriaLiturgica;
    musicas: MusicaLista[];
    criadaEm: string;
    atualizadaEm: string;
    // Campos de lista privada (undefined = pública, retrocompatível)
    tipo?: TipoLista;
    donoUid?: string;
    participantes?: Participante[];
    tokenConvite?: string;
}

export interface ListasDoDiaResponse {
    listas: Lista[];
    assinaturaExpirada: boolean;
}
