import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthRepository } from '../repositories/auth.repository.interface';
import { AppUser } from '../models/user.model';

const adminUser: AppUser = {
  uid: 'uid-admin',
  email: 'admin@teste.com',
  displayName: 'Admin',
  role: 'admin',
  grupoIds: [],
  criadoEm: '2024-01-01T00:00:00Z',
  ultimoLogin: '2024-01-01T00:00:00Z',
};

const membroUser: AppUser = { ...adminUser, uid: 'uid-membro', role: 'membro' };
const convidadoUser: AppUser = { ...adminUser, uid: 'uid-conv', role: 'convidado' };

function makeRepo(user: AppUser | null) {
  return {
    onAuthStateChanged: () => of(user),
    loginComEmail: vi.fn(),
    registrar: vi.fn(),
    loginSocial: vi.fn(),
    logout: vi.fn().mockReturnValue(of(void 0)),
    getUsuarioAtual: vi.fn(),
    getRole: vi.fn(),
    atualizarPerfil: vi.fn(),
    criarGrupo: vi.fn(),
    getGrupo: vi.fn(),
    getGruposDoUsuario: vi.fn(),
    adicionarMembroAoGrupo: vi.fn(),
    removerMembroDoGrupo: vi.fn(),
    compartilharListaComGrupo: vi.fn(),
    criarConvite: vi.fn(),
    resgatarConvite: vi.fn(),
    getConvitesDoGrupo: vi.fn(),
    revogarConvite: vi.fn(),
  };
}

function setup(user: AppUser | null) {
  TestBed.configureTestingModule({
    providers: [
      AuthService,
      { provide: AuthRepository, useValue: makeRepo(user) },
    ],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('estado inicial', () => {
    it('inicia loading como false após auth state resolver', () => {
      const svc = setup(null);
      expect(svc.loading()).toBe(false);
    });

    it('isLogado = false quando não há usuário', () => {
      const svc = setup(null);
      expect(svc.isLogado()).toBe(false);
    });

    it('isLogado = true quando há usuário', () => {
      const svc = setup(adminUser);
      expect(svc.isLogado()).toBe(true);
    });

    it('user() retorna o usuário logado', () => {
      const svc = setup(adminUser);
      expect(svc.user()?.uid).toBe('uid-admin');
    });
  });

  describe('role e isAdmin', () => {
    it('role retorna "visitante" quando não logado', () => {
      const svc = setup(null);
      expect(svc.role()).toBe('visitante');
    });

    it('role retorna o role do usuário logado', () => {
      const svc = setup(membroUser);
      expect(svc.role()).toBe('membro');
    });

    it('isAdmin = true para admin', () => {
      const svc = setup(adminUser);
      expect(svc.isAdmin()).toBe(true);
    });

    it('isAdmin = false para membro', () => {
      const svc = setup(membroUser);
      expect(svc.isAdmin()).toBe(false);
    });
  });

  describe('hasRole (hierarquia)', () => {
    it('admin tem acesso a role editor', () => {
      const svc = setup(adminUser);
      expect(svc.hasRole('editor')).toBe(true);
    });

    it('admin tem acesso a role convidado', () => {
      const svc = setup(adminUser);
      expect(svc.hasRole('convidado')).toBe(true);
    });

    it('membro não tem acesso a role convidado', () => {
      const svc = setup(membroUser);
      expect(svc.hasRole('convidado')).toBe(false);
    });

    it('convidado não tem acesso a role editor', () => {
      const svc = setup(convidadoUser);
      expect(svc.hasRole('editor')).toBe(false);
    });

    it('visitante não tem acesso a nenhum role elevado', () => {
      const svc = setup(null);
      expect(svc.hasRole('membro')).toBe(false);
    });
  });
});
