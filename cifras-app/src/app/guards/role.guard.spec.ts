import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import { UserRole, ROLE_HIERARCHY } from '../models/user.model';

const mockRouter = {
  createUrlTree: (commands: unknown[]) => ({ commands }),
};

function setupGuard(logado: boolean, role: UserRole) {
  const authService = {
    loading: signal(false),
    isLogado: signal(logado),
    hasRole: (required: UserRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[required],
  } as unknown as AuthService;

  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: AuthService, useValue: authService },
    ],
  });
}

async function runRoleGuard(requiredRole: UserRole) {
  return firstValueFrom(
    TestBed.runInInjectionContext(() =>
      roleGuard(requiredRole)({} as never, {} as never)
    ) as any
  );
}

describe('roleGuard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('permite admin acessar rota de editor', async () => {
    setupGuard(true, 'admin');
    expect(await runRoleGuard('editor')).toBe(true);
  });

  it('permite admin acessar rota de convidado', async () => {
    setupGuard(true, 'admin');
    expect(await runRoleGuard('convidado')).toBe(true);
  });

  it('permite convidado acessar rota de membro', async () => {
    setupGuard(true, 'convidado');
    expect(await runRoleGuard('membro')).toBe(true);
  });

  it('bloqueia membro de acessar rota de convidado (redireciona para /)', async () => {
    setupGuard(true, 'membro');
    const result = await runRoleGuard('convidado');
    expect(result).not.toBe(true);
    expect((result as any).commands).toContain('/');
  });

  it('redireciona para /admin quando não está logado', async () => {
    setupGuard(false, 'visitante');
    const result = await runRoleGuard('membro');
    expect(result).not.toBe(true);
    expect((result as any).commands).toContain('/admin');
  });
});
