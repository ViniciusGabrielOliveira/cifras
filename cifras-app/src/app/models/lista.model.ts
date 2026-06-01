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
    tom?: string;        // tom personalizado para esta música nesta lista
    observacao?: string; // ex: "capotraste na 1ª casa"
}

export interface Lista {
    id: string;
    titulo: string;
    /** @deprecated use dataInicio/dataFim */
    data?: string;
    dataInicio?: string;
    dataFim?: string;
    todosDias?: boolean;
    categoria?: CategoriaLiturgica;
    musicas: MusicaLista[];
    criadaEm: string;
    atualizadaEm: string;
    // Campos de lista privada (undefined = pública, retrocompatível)
    tipo?: TipoLista;
    donoUid?: string;
    donoNome?: string;
    participantes?: Participante[];
    participantesUids?: string[]; // espelho de participantes[].uid para queries array-contains
    controladoresUids?: string[]; // UIDs que podem controlar o modo live
    tokenConvite?: string;
    // Ordem, seleção e labels customizados de partes; se ausente usa ordem global do ConfigService
    partes?: ParteLista[];
}

export interface ParteLista {
    id: string;
    label?: string; // sobrescreve o label global apenas nesta lista
}

export interface ListasDoDiaResponse {
    listas: Lista[];
    assinaturaExpirada: boolean;
}
