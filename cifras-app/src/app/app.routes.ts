import { Routes } from '@angular/router';

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

    // ── Visualização de Cifra ──────────────────────────────────────
    {
        path: 'cifra/:id',
        loadComponent: () =>
            import('./pages/cifra-detail/cifra-detail').then(m => m.CifraDetailComponent),
    },

    // ── Admin ──────────────────────────────────────────────────────
    {
        path: 'admin',
        loadComponent: () =>
            import('./pages/admin/login/login').then(m => m.LoginComponent),
    },
    {
        path: 'admin/painel',
        loadComponent: () =>
            import('./pages/admin/painel/painel').then(m => m.PainelComponent),
    },
    {
        path: 'admin/nova-cifra',
        loadComponent: () =>
            import('./pages/admin/nova-cifra/nova-cifra').then(m => m.NovaCifraComponent),
    },
    {
        path: 'admin/editar-cifra/:id',
        loadComponent: () =>
            import('./pages/admin/cifra-editor/cifra-editor').then(m => m.CifraEditorComponent),
    },

    // ── Fallback ───────────────────────────────────────────────────
    { path: '**', redirectTo: '' },
];
