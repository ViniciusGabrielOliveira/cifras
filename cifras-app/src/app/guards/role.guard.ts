import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

/**
 * Factory de guard por role: verifica se o usuário tem nível de acesso
 * suficiente (hierárquico). Ex: `roleGuard('editor')` permite admin e editor.
 * Aguarda o estado loading do AuthService para evitar falsos negativos no refresh.
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

    return toObservable(auth.loading).pipe(
      filter(loading => !loading),
      map(() => {
        if (!auth.isLogado()) {
          return router.createUrlTree(['/admin']);
        }
        if (auth.hasRole(requiredRole)) {
          return true;
        }
        // Logado mas sem permissão — redireciona para home
        return router.createUrlTree(['/']);
      })
    );
  };
}
