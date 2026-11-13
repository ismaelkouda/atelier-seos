import { Routes } from '@angular/router';

export const appRoutes: Routes = [
    {
        path: '',
        data: { access: { mode: 'public', permissions: [] } },
        loadComponent: () =>
            import('./pages/page_a11ca71000000001/page.component').then(
                (module) => module.PageComponent
            ),
    },
    { path: '**', redirectTo: '' },
];
