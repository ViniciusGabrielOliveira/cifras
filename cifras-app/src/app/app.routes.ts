import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
    // ── Home ─────────────────────────────────────────────────────────
    {
        path: '',
        loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent),
    },
    {
        path: 'repertorio',
        loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent),
    },

    // ── Admin ──────────────────────────────────────────────────────
    {
        path: 'admin',
        loadComponent: () =>
            import('./pages/admin/login/login').then(m => m.LoginComponent),
    },
    {
        path: 'admin/cadastro',
        loadComponent: () =>
            import('./pages/admin/cadastro/cadastro').then(m => m.CadastroComponent),
    },
    {
        path: 'admin/completar-cadastro',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./pages/admin/completar-cadastro/completar-cadastro').then(m => m.CompletarCadastroComponent),
    },
    {
        path: 'admin/painel',
        canActivate: [authGuard, roleGuard('membro')],
        loadComponent: () =>
            import('./pages/admin/painel/painel').then(m => m.PainelComponent),
    },
    {
        path: 'admin/nova-cifra',
        canActivate: [authGuard, roleGuard('editor')],
        loadComponent: () =>
            import('./pages/admin/cifra-editor/cifra-editor').then(m => m.CifraEditorComponent),
    },
    {
        path: 'admin/editar-cifra/:id',
        canActivate: [authGuard, roleGuard('editor')],
        loadComponent: () =>
            import('./pages/admin/cifra-editor/cifra-editor').then(m => m.CifraEditorComponent),
    },
    {
        path: 'admin/lista/:id',
        canActivate: [authGuard, roleGuard('membro')],
        data: { adminContext: true },
        loadComponent: () =>
            import('./pages/usuario/minha-lista/minha-lista').then(m => m.MinhaListaComponent),
    },
    {
        path: 'admin/prs',
        canActivate: [authGuard, roleGuard('admin')],
        loadComponent: () =>
            import('./pages/admin/prs/prs').then(m => m.PrsComponent),
    },

    // ── Área do Usuário ────────────────────────────────────────────
    {
        path: 'minha-area',
        redirectTo: 'admin/painel',
        pathMatch: 'full',
    },
    {
        path: 'minha-area/lista/:id',
        canActivate: [authGuard, roleGuard('membro')],
        loadComponent: () =>
            import('./pages/usuario/minha-lista/minha-lista').then(m => m.MinhaListaComponent),
    },
    {
        path: 'minha-area/nova-musica',
        canActivate: [authGuard, roleGuard('membro')],
        data: { userMode: true },
        loadComponent: () =>
            import('./pages/admin/cifra-editor/cifra-editor').then(m => m.CifraEditorComponent),
    },
    {
        path: 'minha-area/editar-musica/:id',
        canActivate: [authGuard, roleGuard('membro')],
        data: { userMode: true },
        loadComponent: () =>
            import('./pages/admin/cifra-editor/cifra-editor').then(m => m.CifraEditorComponent),
    },
    {
        path: 'join/:listaId',
        loadComponent: () =>
            import('./pages/usuario/join/join').then(m => m.JoinComponent),
    },

    // ── Fallback ───────────────────────────────────────────────────
    { path: '**', redirectTo: '' },
];
