import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'cifra/harpa-crista-porque-ele-vive',
        pathMatch: 'full',
    },
    {
        path: 'cifra/:id',
        loadComponent: () =>
            import('./pages/cifra-detail/cifra-detail').then(m => m.CifraDetailComponent),
    },
    {
        path: 'editor/:id',
        loadComponent: () =>
            import('./pages/cifra-editor/cifra-editor').then(m => m.CifraEditorComponent),
    },
];
