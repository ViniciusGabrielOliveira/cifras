// ── Roles ────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'editor' | 'convidado' | 'membro' | 'visitante';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  editor: 50,
  convidado: 30,
  membro: 20,
  visitante: 0,
};

// ── Usuário ──────────────────────────────────────────────────────────
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  telefone?: string;         // celular (apenas cadastro, sem login por tel)
  role: UserRole;
  grupoIds: string[];       // grupos dos quais participa
  criadoEm: string;         // ISO timestamp
  ultimoLogin: string;      // ISO timestamp
}

// ── Provedor de autenticação ─────────────────────────────────────────
export type AuthProvider = 'email' | 'google' | 'apple';

// ── Grupo de Usuários ────────────────────────────────────────────────
export interface GrupoMembro {
  uid: string;
  displayName: string;
  role: UserRole;            // role dentro do grupo (admin, membro)
  entradaEm: string;         // ISO timestamp
}

export interface Grupo {
  id: string;
  nome: string;
  descricao?: string;
  admins: string[];           // UIDs dos admins do grupo
  membros: GrupoMembro[];
  listasCompartilhadas: string[]; // IDs das listas compartilhadas
  criadoEm: string;
  atualizadoEm: string;
}

// ── Convite para Grupo ───────────────────────────────────────────────
export type ConviteStatus = 'pendente' | 'aceito' | 'expirado' | 'revogado';

export interface ConviteGrupo {
  id: string;
  grupoId: string;
  grupoNome: string;
  codigo: string;             // código curto para o usuário digitar
  criadoPorUid: string;       // UID do admin que gerou
  criadoPorNome: string;
  destinatarioEmail?: string; // opcional, pode ser convite aberto
  role: UserRole;             // role que o convidado terá ao entrar
  status: ConviteStatus;
  criadoEm: string;
  expiraEm: string;           // ISO timestamp de expiração
}

// ── Auth State ───────────────────────────────────────────────────────
export interface AuthState {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
}
