import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, from, of, throwError, BehaviorSubject, switchMap, map, catchError } from 'rxjs';
import { FIREBASE_APP, fromFirebaseListener } from '../firebase.providers';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  OAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import { AuthRepository } from './auth.repository.interface';
import {
  AppUser, AuthProvider as AppAuthProvider, ConviteGrupo, Grupo, GrupoMembro, UserRole, ROLE_HIERARCHY,
} from '../models/user.model';

// ── Helpers ──────────────────────────────────────────────────────────

function validarRole(raw: unknown): UserRole {
  if (typeof raw === 'string' && raw in ROLE_HIERARCHY) return raw as UserRole;
  return 'visitante';
}

function gerarCodigo(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function firebaseUserToAppUser(fbUser: FirebaseUser, role: UserRole = 'membro', grupoIds: string[] = []): AppUser {
  return {
    uid: fbUser.uid,
    email: fbUser.email ?? '',
    displayName: fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'Usuário',
    photoURL: fbUser.photoURL ?? undefined,
    role,
    grupoIds,
    criadoEm: fbUser.metadata.creationTime ?? new Date().toISOString(),
    ultimoLogin: new Date().toISOString(),
  };
}

// ── Firebase Repository ──────────────────────────────────────────────

@Injectable()
export class AuthFirebaseRepository extends AuthRepository {
  private app = inject(FIREBASE_APP);
  private auth = getAuth(this.app);
  private firestore = getFirestore(this.app);
  private zone = inject(NgZone);
  private authState$ = new BehaviorSubject<AppUser | null>(null);

  constructor() {
    super();
    
    fromFirebaseListener<FirebaseUser | null>((next, error) => onAuthStateChanged(this.auth, next, error))
      .subscribe(async (fbUser) => {
      if (fbUser) {
        try {
          const appUser = await this.getOrCreateUserDoc(fbUser);
          this.zone.run(() => this.authState$.next(appUser));
        } catch {
          // Firestore offline — usa dados básicos do Firebase Auth
          const fallback = firebaseUserToAppUser(fbUser);
          this.zone.run(() => this.authState$.next(fallback));
        }
      } else {
        this.zone.run(() => this.authState$.next(null));
      }
    });
  }

  // ── Autenticação ─────────────────────────────────────────────────

  loginComEmail(email: string, senha: string): Observable<AppUser> {
    return from(signInWithEmailAndPassword(this.auth, email, senha)).pipe(
      switchMap(cred => from(this.getOrCreateUserDoc(cred.user))),
      catchError(err => throwError(() => new Error(this.traduzirErroFirebase(err.code)))),
    );
  }

  registrar(email: string, senha: string, displayName: string, telefone?: string): Observable<AppUser> {
    return from(createUserWithEmailAndPassword(this.auth, email, senha)).pipe(
      switchMap(cred => {
        // Atualiza displayName no Firebase Auth
        return from(updateProfile(cred.user, { displayName })).pipe(
          switchMap(() => {
            // Cria doc no Firestore com telefone
            const newUser: AppUser = {
              uid: cred.user.uid,
              email: cred.user.email ?? email,
              displayName,
              telefone: telefone || undefined,
              role: 'membro',
              grupoIds: [],
              criadoEm: new Date().toISOString(),
              ultimoLogin: new Date().toISOString(),
            };
            const userRef = doc(this.firestore, `users/${cred.user.uid}`);
            return from(setDoc(userRef, newUser)).pipe(map(() => newUser));
          }),
        );
      }),
      catchError(err => throwError(() => new Error(this.traduzirErroFirebase(err.code)))),
    );
  }

  loginSocial(provider: AppAuthProvider): Observable<AppUser> {
    const authProvider = this.getFirebaseProvider(provider);
    if (!authProvider) {
      return throwError(() => new Error(`Provedor "${provider}" não suportado`));
    }
    return from(signInWithPopup(this.auth, authProvider)).pipe(
      switchMap(cred => from(this.getOrCreateUserDoc(cred.user))),
      catchError(err => throwError(() => new Error(this.traduzirErroFirebase(err.code)))),
    );
  }

  logout(): Observable<void> {
    return from(signOut(this.auth));
  }

  getUsuarioAtual(): Observable<AppUser | null> {
    return of(this.authState$.value);
  }

  onAuthStateChanged(): Observable<AppUser | null> {
    return this.authState$.asObservable();
  }

  // ── Perfil & Role ────────────────────────────────────────────────

  getRole(uid: string): Observable<UserRole> {
    const userRef = doc(this.firestore, `users/${uid}`);
    return from(getDoc(userRef)).pipe(
      map(snap => snap.exists() ? validarRole(snap.data()?.['role']) : 'visitante'),
      catchError(() => of('visitante' as UserRole)),
    );
  }

  atualizarPerfil(uid: string, dados: Partial<AppUser>): Observable<AppUser> {
    const userRef = doc(this.firestore, `users/${uid}`);
    return from(updateDoc(userRef, { ...dados, ultimoLogin: new Date().toISOString() })).pipe(
      switchMap(() => from(getDoc(userRef))),
      map(snap => {
        const data = snap.data() as AppUser & { role: unknown };
        return { ...data, role: validarRole(data.role) } as AppUser;
      }),
    );
  }

  // ── Grupos ───────────────────────────────────────────────────────

  criarGrupo(grupo: Omit<Grupo, 'id' | 'criadoEm' | 'atualizadoEm'>): Observable<Grupo> {
    const gruposCol = collection(this.firestore, 'grupos');
    const now = new Date().toISOString();
    const data = { ...grupo, criadoEm: now, atualizadoEm: now };
    return from(addDoc(gruposCol, data)).pipe(
      map(ref => ({ ...data, id: ref.id }) as Grupo),
    );
  }

  getGrupo(grupoId: string): Observable<Grupo | null> {
    const grupoRef = doc(this.firestore, `grupos/${grupoId}`);
    return from(getDoc(grupoRef)).pipe(
      map(snap => snap.exists() ? { id: snap.id, ...snap.data() } as Grupo : null),
    );
  }

  getGruposDoUsuario(uid: string): Observable<Grupo[]> {
    const gruposCol = collection(this.firestore, 'grupos');
    const q = query(gruposCol, where('membroUids', 'array-contains', uid));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() }) as Grupo)),
      catchError(() => of([])),
    );
  }

  adicionarMembroAoGrupo(grupoId: string, uid: string, role: UserRole): Observable<Grupo> {
    return this.getGrupo(grupoId).pipe(
      switchMap(grupo => {
        if (!grupo) return throwError(() => new Error('Grupo não encontrado'));
        if (grupo.membros.some(m => m.uid === uid)) return of(grupo);

        const membro: GrupoMembro = {
          uid,
          displayName: this.authState$.value?.displayName ?? `Usuário ${uid}`,
          role,
          entradaEm: new Date().toISOString(),
        };
        const membros = [...grupo.membros, membro];
        const atualizadoEm = new Date().toISOString();

        const grupoRef = doc(this.firestore, `grupos/${grupoId}`);
        return from(updateDoc(grupoRef, { membros, atualizadoEm })).pipe(
          map(() => ({ ...grupo, membros, atualizadoEm }))
        );
      }),
    );
  }

  removerMembroDoGrupo(grupoId: string, uid: string): Observable<Grupo> {
    return this.getGrupo(grupoId).pipe(
      switchMap(grupo => {
        if (!grupo) return throwError(() => new Error('Grupo não encontrado'));
        const membros = grupo.membros.filter(m => m.uid !== uid);
        const atualizadoEm = new Date().toISOString();

        const grupoRef = doc(this.firestore, `grupos/${grupoId}`);
        return from(updateDoc(grupoRef, { membros, atualizadoEm })).pipe(
          map(() => ({ ...grupo, membros, atualizadoEm }))
        );
      }),
    );
  }

  compartilharListaComGrupo(grupoId: string, listaId: string): Observable<Grupo> {
    return this.getGrupo(grupoId).pipe(
      switchMap(grupo => {
        if (!grupo) return throwError(() => new Error('Grupo não encontrado'));
        const listasCompartilhadas = grupo.listasCompartilhadas.includes(listaId)
          ? grupo.listasCompartilhadas
          : [...grupo.listasCompartilhadas, listaId];
        const atualizadoEm = new Date().toISOString();
        const grupoRef = doc(this.firestore, `grupos/${grupoId}`);
        return from(updateDoc(grupoRef, { listasCompartilhadas, atualizadoEm })).pipe(
          map(() => ({ ...grupo, listasCompartilhadas, atualizadoEm }))
        );
      }),
    );
  }

  // ── Convites ─────────────────────────────────────────────────────

  criarConvite(grupoId: string, role: UserRole, destinatarioEmail?: string): Observable<ConviteGrupo> {
    return this.getGrupo(grupoId).pipe(
      switchMap(grupo => {
        if (!grupo) return throwError(() => new Error('Grupo não encontrado'));

        const user = this.authState$.value;
        if (!user || !grupo.admins.includes(user.uid)) {
          return throwError(() => new Error('Apenas admins do grupo podem criar convites'));
        }

        const convite: Omit<ConviteGrupo, 'id'> = {
          grupoId,
          grupoNome: grupo.nome,
          codigo: gerarCodigo(),
          criadoPorUid: user.uid,
          criadoPorNome: user.displayName,
          destinatarioEmail,
          role,
          status: 'pendente',
          criadoEm: new Date().toISOString(),
          expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const convitesCol = collection(this.firestore, 'convites');
        return from(addDoc(convitesCol, convite)).pipe(
          map(ref => ({ ...convite, id: ref.id }) as ConviteGrupo),
        );
      }),
    );
  }

  resgatarConvite(codigo: string, uid: string): Observable<Grupo> {
    const convitesCol = collection(this.firestore, 'convites');
    const q = query(convitesCol, where('codigo', '==', codigo), where('status', '==', 'pendente'));

    return from(getDocs(q)).pipe(
      switchMap(snap => {
        if (snap.empty) return throwError(() => new Error('Convite inválido ou expirado'));

        const conviteDoc = snap.docs[0];
        const convite = { id: conviteDoc.id, ...conviteDoc.data() } as ConviteGrupo;

        if (new Date(convite.expiraEm) < new Date()) {
          return from(updateDoc(conviteDoc.ref, { status: 'expirado' })).pipe(
            switchMap(() => throwError(() => new Error('Convite expirado'))),
          );
        }

        return from(updateDoc(conviteDoc.ref, { status: 'aceito' })).pipe(
          switchMap(() => this.adicionarMembroAoGrupo(convite.grupoId, uid, convite.role)),
        );
      }),
    );
  }

  getConvitesDoGrupo(grupoId: string): Observable<ConviteGrupo[]> {
    const convitesCol = collection(this.firestore, 'convites');
    const q = query(convitesCol, where('grupoId', '==', grupoId));
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() }) as ConviteGrupo)),
    );
  }

  revogarConvite(conviteId: string): Observable<void> {
    const conviteRef = doc(this.firestore, `convites/${conviteId}`);
    return from(updateDoc(conviteRef, { status: 'revogado' })).pipe(map(() => undefined));
  }

  // ── Helpers privados ─────────────────────────────────────────────

  /**
   * Busca ou cria o documento do usuário no Firestore.
   * Na primeira vez, define role = 'membro'. Roles são gerenciadas
   * manualmente no Firestore ou via Cloud Functions.
   */
  private async getOrCreateUserDoc(fbUser: FirebaseUser): Promise<AppUser> {
    const userRef = doc(this.firestore, `users/${fbUser.uid}`);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data() as AppUser & { role: unknown };
      updateDoc(userRef, { ultimoLogin: new Date().toISOString() }).catch(() => {});
      return { ...data, role: validarRole(data.role), uid: fbUser.uid, ultimoLogin: new Date().toISOString() };
    }

    // Primeiro login — cria documento
    const newUser = firebaseUserToAppUser(fbUser);
    await setDoc(userRef, newUser);
    return newUser;
  }

  private getFirebaseProvider(provider: AppAuthProvider) {
    switch (provider) {
      case 'google': return new GoogleAuthProvider();
      case 'apple': return new OAuthProvider('apple.com');
      default: return null;
    }
  }

  private traduzirErroFirebase(code: string): string {
    const msgs: Record<string, string> = {
      'auth/user-not-found': 'Usuário não encontrado',
      'auth/wrong-password': 'Senha incorreta',
      'auth/invalid-email': 'E-mail inválido',
      'auth/user-disabled': 'Conta desativada',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'auth/popup-closed-by-user': 'Login cancelado',
      'auth/account-exists-with-different-credential': 'Conta já existe com outro provedor',
      'auth/invalid-credential': 'E-mail ou senha inválidos',
    };
    return msgs[code] ?? 'Erro de autenticação. Tente novamente.';
  }
}
