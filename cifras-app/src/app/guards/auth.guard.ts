import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard básico: permite acesso apenas se o usuário estiver logado.
 * Redireciona para /admin (login) caso contrário.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLogado()) {
    return true;
  }
  return router.createUrlTree(['/admin']);
};
