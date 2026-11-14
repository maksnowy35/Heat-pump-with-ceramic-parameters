import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'record' },
  {
    path: 'record',
    title: 'HeatFlip · Record',
    loadComponent: () => import('./pages/record/record').then(m => m.RecordPage),
  },
  {
    path: 'overview',
    title: 'HeatFlip · Whole record',
    loadComponent: () => import('./pages/overview/overview').then(m => m.OverviewPage),
  },
  {
    path: 'window',
    title: 'HeatFlip · 30-minute window',
    loadComponent: () => import('./pages/window/window').then(m => m.WindowPage),
  },
  {
    path: 'cycle',
    title: 'HeatFlip · One cycle',
    loadComponent: () => import('./pages/cycle/cycle').then(m => m.CyclePage),
  },
  {
    path: 'cop',
    title: 'HeatFlip · COP blocks',
    loadComponent: () => import('./pages/cop/cop').then(m => m.CopPage),
  },
  { path: '**', redirectTo: 'record' },
];
