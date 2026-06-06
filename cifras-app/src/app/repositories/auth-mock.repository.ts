import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError, delay } from 'rxjs';
import { AuthRepository } from './auth.repository.interface';
import { AppUser, AuthProvider, ConviteGrupo, Grupo, GrupoMembro, UserRole } from '../models/user.model';

// ── Dados mock ───────────────────────────────────────────────────────
const MOCK_USERS: Record<string, { senha: string; user: AppUser }> = {
  'admin@cifras.missa': {
    senha: 'missa2025',
    user: {
      uid: 'uid-admin-001',
      email: 'admin@cifras.missa',
      displayName: 'Administrador',
      role: 'admin',
      grupoIds: ['grupo-001'],
      criadoEm: '2025-01-01T00:00:00Z',
      ultimoLogin: new Date().toISOString(),
    },
  },
  'editor@cifras.missa': {
    senha: 'editor2025',
    user: {
      uid: 'uid-editor-001',
      email: 'editor@cifras.missa',
      displayName: 'Editor',
      role: 'editor',
      grupoIds: ['grupo-001'],
      criadoEm: '2025-02-01T00:00:00Z',
      ultimoLogin: new Date().toISOString(),
    },
  },
  'membro@cifras.missa': {
    senha: 'membro2025',
    user: {
      uid: 'uid-membro-001',
      email: 'membro@cifras.missa',
      displayName: 'Membro',
      role: 'membro',
      grupoIds: ['grupo-001'],
      criadoEm: '2025-03-01T00:00:00Z',
      ultimoLogin: new Date().toISOString(),
    },
  },
};

const MOCK_GRUPOS: Grupo[] = [
  {
    id: 'grupo-001',
    nome: 'Paróquia São José',
    descricao: 'Grupo do ministério de música da Paróquia São José',
    admins: ['uid-admin-001'],
    membros: [
      { uid: 'uid-admin-001', displayName: 'Administrador', role: 'admin', entradaEm: '2025-01-01T00:00:00Z' },
      { uid: 'uid-editor-001', displayName: 'Editor', role: 'editor', entradaEm: '2025-02-01T00:00:00Z' },
      { uid: 'uid-membro-001', displayName: 'Membro', role: 'membro', entradaEm: '2025-03-01T00:00:00Z' },
    ],
    listasCompartilhadas: [],
    criadoEm: '2025-01-01T00:00:00Z',
    atualizadoEm: '2025-03-01T00:00:00Z',
  },
];

const MOCK_CONVITES: ConviteGrupo[] = [];

function gerarCodigo(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function gerarId(): string {
  return 'id-' + Math.random().toString(36).substring(2, 10);
}

// ── Implementação Mock ───────────────────────────────────────────────
@Injectable()
export class AuthMockRepository extends AuthRepository {
  private readonly AUTH_KEY = 'cifras_auth_user';
  private authState$ = new BehaviorSubject<AppUser | null>(this.carregarDoStorage());
  private grupos = [...MOCK_GRUPOS];
  private convites = [...MOCK_CONVITES];

  // ── Autenticação ─────────────────────────────────────────────────

  loginComEmail(email: string, senha: string): Observable<AppUser> {
    const entry = MOCK_USERS[email];
    if (!entry || entry.senha !== senha) {
      return throwError(() => new Error('E-mail ou senha inválidos'));
    }
    const user = { ...entry.user, ultimoLogin: new Date().toISOString() };
    this.setUser(user);
    return of(user).pipe(delay(300));
  }

  registrar(email: string, senha: string, displayName: string, telefone?: string): Observable<AppUser> {
    if (MOCK_USERS[email]) {
      return throwError(() => new Error('Este e-mail já está cadastrado'));
    }
    const user: AppUser = {
      uid: `uid-${Date.now()}`,
      email,
      displayName,
      telefone: telefone || undefined,
      role: 'membro',
      grupoIds: [],
      criadoEm: new Date().toISOString(),
      ultimoLogin: new Date().toISOString(),
    };
    MOCK_USERS[email] = { senha, user };
    this.setUser(user);
    return of(user).pipe(delay(400));
  }

  loginSocial(provider: AuthProvider): Observable<AppUser> {
    // Simula login social retornando o admin
    const user: AppUser = {
      uid: `uid-social-${Date.now()}`,
      email: `user-${provider}@gmail.com`,
      displayName: `Usuário ${provider}`,
      photoURL: `https://ui-avatars.com/api/?name=${provider}&background=random`,
      role: 'membro',
      grupoIds: [],
      criadoEm: new Date().toISOString(),
      ultimoLogin: new Date().toISOString(),
    };
    this.setUser(user);
    return of(user).pipe(delay(500));
  }

  logout(): Observable<void> {
    localStorage.removeItem(this.AUTH_KEY);
    this.authState$.next(null);
    return of(undefined).pipe(delay(100));
  }

  getUsuarioAtual(): Observable<AppUser | null> {
    return of(this.authState$.value);
  }

  onAuthStateChanged(): Observable<AppUser | null> {
    return this.authState$.asObservable();
  }

  // ── Perfil & Role ────────────────────────────────────────────────

  getRole(uid: string): Observable<UserRole> {
    const found = Object.values(MOCK_USERS).find(e => e.user.uid === uid);
    return of(found?.user.role ?? 'visitante').pipe(delay(100));
  }

  atualizarPerfil(uid: string, dados: Partial<AppUser>): Observable<AppUser> {
    const entry = Object.values(MOCK_USERS).find(e => e.user.uid === uid);
    if (!entry) {
      return throwError(() => new Error('Usuário não encontrado'));
    }
    Object.assign(entry.user, dados);
    if (this.authState$.value?.uid === uid) {
      this.setUser({ ...entry.user });
    }
    return of(entry.user).pipe(delay(200));
  }

  // ── Grupos ───────────────────────────────────────────────────────

  criarGrupo(grupo: Omit<Grupo, 'id' | 'criadoEm' | 'atualizadoEm'>): Observable<Grupo> {
    const novoGrupo: Grupo = {
      ...grupo,
      id: gerarId(),
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    this.grupos.push(novoGrupo);
    return of(novoGrupo).pipe(delay(300));
  }

  getGrupo(grupoId: string): Observable<Grupo | null> {
    return of(this.grupos.find(g => g.id === grupoId) ?? null).pipe(delay(100));
  }

  getGruposDoUsuario(uid: string): Observable<Grupo[]> {
    const userGrupos = this.grupos.filter(g =>
      g.membros.some(m => m.uid === uid)
    );
    return of(userGrupos).pipe(delay(200));
  }

  adicionarMembroAoGrupo(grupoId: string, uid: string, role: UserRole): Observable<Grupo> {
    const grupo = this.grupos.find(g => g.id === grupoId);
    if (!grupo) return throwError(() => new Error('Grupo não encontrado'));

    if (!grupo.membros.some(m => m.uid === uid)) {
      const membro: GrupoMembro = {
        uid,
        displayName: `Usuário ${uid}`,
        role,
        entradaEm: new Date().toISOString(),
      };
      grupo.membros.push(membro);
      grupo.atualizadoEm = new Date().toISOString();
    }
    return of({ ...grupo }).pipe(delay(200));
  }

  removerMembroDoGrupo(grupoId: string, uid: string): Observable<Grupo> {
    const grupo = this.grupos.find(g => g.id === grupoId);
    if (!grupo) return throwError(() => new Error('Grupo não encontrado'));

    grupo.membros = grupo.membros.filter(m => m.uid !== uid);
    grupo.atualizadoEm = new Date().toISOString();
    return of({ ...grupo }).pipe(delay(200));
  }

  compartilharListaComGrupo(grupoId: string, listaId: string): Observable<Grupo> {
    const grupo = this.grupos.find(g => g.id === grupoId);
    if (!grupo) return throwError(() => new Error('Grupo não encontrado'));

    if (!grupo.listasCompartilhadas.includes(listaId)) {
      grupo.listasCompartilhadas.push(listaId);
      grupo.atualizadoEm = new Date().toISOString();
    }
    return of({ ...grupo }).pipe(delay(200));
  }

  // ── Convites ─────────────────────────────────────────────────────

  criarConvite(grupoId: string, role: UserRole, destinatarioEmail?: string): Observable<ConviteGrupo> {
    const grupo = this.grupos.find(g => g.id === grupoId);
    if (!grupo) return throwError(() => new Error('Grupo não encontrado'));

    const user = this.authState$.value;
    if (!user || !grupo.admins.includes(user.uid)) {
      return throwError(() => new Error('Apenas admins do grupo podem criar convites'));
    }

    const convite: ConviteGrupo = {
      id: gerarId(),
      grupoId,
      grupoNome: grupo.nome,
      codigo: gerarCodigo(),
      criadoPorUid: user.uid,
      criadoPorNome: user.displayName,
      destinatarioEmail,
      role,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
    };
    this.convites.push(convite);
    return of(convite).pipe(delay(300));
  }

  resgatarConvite(codigo: string, uid: string): Observable<Grupo> {
    const convite = this.convites.find(c =>
      c.codigo === codigo && c.status === 'pendente'
    );
    if (!convite) {
      return throwError(() => new Error('Convite inválido ou expirado'));
    }

    if (new Date(convite.expiraEm) < new Date()) {
      convite.status = 'expirado';
      return throwError(() => new Error('Convite expirado'));
    }

    convite.status = 'aceito';

    // Adiciona membro ao grupo
    const grupo = this.grupos.find(g => g.id === convite.grupoId);
    if (!grupo) return throwError(() => new Error('Grupo não encontrado'));

    if (!grupo.membros.some(m => m.uid === uid)) {
      grupo.membros.push({
        uid,
        displayName: this.authState$.value?.displayName ?? `Usuário ${uid}`,
        role: convite.role,
        entradaEm: new Date().toISOString(),
      });
      grupo.atualizadoEm = new Date().toISOString();
    }

    return of({ ...grupo }).pipe(delay(300));
  }

  getConvitesDoGrupo(grupoId: string): Observable<ConviteGrupo[]> {
    return of(this.convites.filter(c => c.grupoId === grupoId)).pipe(delay(100));
  }

  revogarConvite(conviteId: string): Observable<void> {
    const convite = this.convites.find(c => c.id === conviteId);
    if (convite) convite.status = 'revogado';
    return of(undefined).pipe(delay(100));
  }

  // ── Helpers privados ─────────────────────────────────────────────

  private setUser(user: AppUser): void {
    localStorage.setItem(this.AUTH_KEY, JSON.stringify(user));
    this.authState$.next(user);
  }

  private carregarDoStorage(): AppUser | null {
    try {
      const raw = localStorage.getItem('cifras_auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
