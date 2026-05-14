import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

/**
 * Guard básico: permite acesso apenas se o usuário estiver logado.
 * Redireciona para /admin (login) caso contrário.
 * Aguarda o estado loading do AuthService para evitar falsos negativos no refresh.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.loading).pipe(
    filter(loading => !loading),
    map(() => {
      if (auth.isLogado()) {
        return true;
      }
      return router.createUrlTree(['/admin']);
    })
  );
};
