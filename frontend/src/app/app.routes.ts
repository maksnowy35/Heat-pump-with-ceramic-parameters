import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'HeatFlip · COP',
    loadComponent: () => import('./pages/cop/cop').then(m => m.CopPage),
  },
  { path: '**', redirectTo: '' },
];
