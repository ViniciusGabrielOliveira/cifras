import { Observable } from 'rxjs';
import { AppUser, AuthProvider, ConviteGrupo, Grupo, UserRole } from '../models/user.model';

export abstract class AuthRepository {
  // ── Autenticação ─────────────────────────────────────────────────
  abstract loginComEmail(email: string, senha: string): Observable<AppUser>;
  abstract registrar(email: string, senha: string, displayName: string, telefone?: string): Observable<AppUser>;
  abstract loginSocial(provider: AuthProvider): Observable<AppUser>;
  abstract logout(): Observable<void>;
  abstract getUsuarioAtual(): Observable<AppUser | null>;
  abstract onAuthStateChanged(): Observable<AppUser | null>;

  // ── Perfil & Role ────────────────────────────────────────────────
  abstract getRole(uid: string): Observable<UserRole>;
  abstract atualizarPerfil(uid: string, dados: Partial<AppUser>): Observable<AppUser>;

  // ── Grupos ───────────────────────────────────────────────────────
  abstract criarGrupo(grupo: Omit<Grupo, 'id' | 'criadoEm' | 'atualizadoEm'>): Observable<Grupo>;
  abstract getGrupo(grupoId: string): Observable<Grupo | null>;
  abstract getGruposDoUsuario(uid: string): Observable<Grupo[]>;
  abstract adicionarMembroAoGrupo(grupoId: string, uid: string, role: UserRole): Observable<Grupo>;
  abstract removerMembroDoGrupo(grupoId: string, uid: string): Observable<Grupo>;
  abstract compartilharListaComGrupo(grupoId: string, listaId: string): Observable<Grupo>;

  // ── Convites ─────────────────────────────────────────────────────
  abstract criarConvite(grupoId: string, role: UserRole, destinatarioEmail?: string): Observable<ConviteGrupo>;
  abstract resgatarConvite(codigo: string, uid: string): Observable<Grupo>;
  abstract getConvitesDoGrupo(grupoId: string): Observable<ConviteGrupo[]>;
  abstract revogarConvite(conviteId: string): Observable<void>;
}
