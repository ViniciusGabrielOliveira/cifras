import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { AuthRepository } from '../repositories/auth.repository.interface';
import { AppUser, AuthProvider, AuthState, ConviteGrupo, Grupo, UserRole, ROLE_HIERARCHY } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // ── Estado reativo ───────────────────────────────────────────────
  private state = signal<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  readonly user = computed(() => this.state().user);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly isLogado = computed(() => !!this.state().user);
  readonly role = computed(() => this.state().user?.role ?? 'visitante');
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly displayName = computed(() => this.state().user?.displayName ?? '');
  readonly photoURL = computed(() => this.state().user?.photoURL);

  constructor(private repo: AuthRepository) {
    this.inicializarAuthState();
  }

  // ── Autenticação ─────────────────────────────────────────────────

  login(email: string, senha: string): Observable<AppUser> {
    this.patchState({ loading: true, error: null });
    return this.repo.loginComEmail(email, senha).pipe(
      tap({
        next: user => this.patchState({ user, loading: false }),
        error: err => this.patchState({ loading: false, error: err.message }),
      }),
    );
  }

  registrar(email: string, senha: string, displayName: string, telefone?: string): Observable<AppUser> {
    this.patchState({ loading: true, error: null });
    return this.repo.registrar(email, senha, displayName, telefone).pipe(
      tap({
        next: user => this.patchState({ user, loading: false }),
        error: err => this.patchState({ loading: false, error: err.message }),
      }),
    );
  }

  loginSocial(provider: AuthProvider): Observable<AppUser> {
    this.patchState({ loading: true, error: null });
    return this.repo.loginSocial(provider).pipe(
      tap({
        next: user => this.patchState({ user, loading: false }),
        error: err => this.patchState({ loading: false, error: err.message }),
      }),
    );
  }

  logout(): Observable<void> {
    return this.repo.logout().pipe(
      tap(() => this.patchState({ user: null, loading: false, error: null })),
    );
  }

  atualizarPerfil(dados: Partial<AppUser>): Observable<AppUser> {
    const uid = this.user()?.uid;
    if (!uid) throw new Error('Usuário não autenticado');
    this.patchState({ loading: true, error: null });
    return this.repo.atualizarPerfil(uid, dados).pipe(
      tap({
        next: user => this.patchState({ user, loading: false }),
        error: err => this.patchState({ loading: false, error: err.message }),
      }),
    );
  }

  // ── Verificação de Role ──────────────────────────────────────────

  hasRole(requiredRole: UserRole): boolean {
    const currentLevel = ROLE_HIERARCHY[this.role()];
    const requiredLevel = ROLE_HIERARCHY[requiredRole];
    return currentLevel >= requiredLevel;
  }

  hasExactRole(role: UserRole): boolean {
    return this.role() === role;
  }

  // ── Grupos ───────────────────────────────────────────────────────

  getGruposDoUsuario(): Observable<Grupo[]> {
    const uid = this.user()?.uid;
    if (!uid) return new Observable(sub => { sub.next([]); sub.complete(); });
    return this.repo.getGruposDoUsuario(uid);
  }

  criarGrupo(nome: string, descricao?: string): Observable<Grupo> {
    const user = this.user();
    if (!user) throw new Error('Usuário não autenticado');
    return this.repo.criarGrupo({
      nome,
      descricao,
      admins: [user.uid],
      membros: [{
        uid: user.uid,
        displayName: user.displayName,
        role: 'admin',
        entradaEm: new Date().toISOString(),
      }],
      listasCompartilhadas: [],
    });
  }

  compartilharLista(grupoId: string, listaId: string): Observable<Grupo> {
    return this.repo.compartilharListaComGrupo(grupoId, listaId);
  }

  // ── Convites ─────────────────────────────────────────────────────

  criarConvite(grupoId: string, role: UserRole = 'membro', email?: string): Observable<ConviteGrupo> {
    return this.repo.criarConvite(grupoId, role, email);
  }

  resgatarConvite(codigo: string): Observable<Grupo> {
    const uid = this.user()?.uid;
    if (!uid) throw new Error('Usuário não autenticado');
    return this.repo.resgatarConvite(codigo, uid);
  }

  getConvites(grupoId: string): Observable<ConviteGrupo[]> {
    return this.repo.getConvitesDoGrupo(grupoId);
  }

  revogarConvite(conviteId: string): Observable<void> {
    return this.repo.revogarConvite(conviteId);
  }

  // ── Helpers privados ─────────────────────────────────────────────

  private inicializarAuthState(): void {
    this.repo.onAuthStateChanged().subscribe(user => {
      this.patchState({ user, loading: false });
    });
  }

  private patchState(partial: Partial<AuthState>): void {
    this.state.update(s => ({ ...s, ...partial }));
  }
}
