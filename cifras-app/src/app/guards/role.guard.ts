import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

/**
 * Factory de guard por role: verifica se o usuário tem nível de acesso
 * suficiente (hierárquico). Ex: `roleGuard('editor')` permite admin e editor.
 *
 * Uso nas rotas:
 * ```ts
 * { path: 'admin/painel', canActivate: [authGuard, roleGuard('editor')], ... }
 * ```
 */
export function roleGuard(requiredRole: UserRole): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isLogado()) {
      return router.createUrlTree(['/admin']);
    }

    if (auth.hasRole(requiredRole)) {
      return true;
    }

    // Logado mas sem permissão — redireciona para home
    return router.createUrlTree(['/']);
  };
}
