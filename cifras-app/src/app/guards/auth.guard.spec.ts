import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

const mockRouter = {
  createUrlTree: (commands: unknown[]) => ({ commands }),
};

function setupGuard(logado: boolean) {
  const authService = {
    loading: signal(false),
    isLogado: signal(logado),
  } as unknown as AuthService;

  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: AuthService, useValue: authService },
    ],
  });
}

describe('authGuard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('retorna true quando o usuário está logado', async () => {
    setupGuard(true);
    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => authGuard({} as never, {} as never)) as any
    );
    expect(result).toBe(true);
  });

  it('retorna UrlTree para /admin quando não está logado', async () => {
    setupGuard(false);
    const result = await firstValueFrom(
      TestBed.runInInjectionContext(() => authGuard({} as never, {} as never)) as any
    );
    expect(result).not.toBe(true);
    expect((result as any).commands).toContain('/admin');
  });
});
