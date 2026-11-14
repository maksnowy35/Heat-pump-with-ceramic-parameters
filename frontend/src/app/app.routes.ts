import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'HeatFlip',
    loadComponent: () => import('./pages/home/home').then(m => m.HomePage),
  },
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
  {
    path: 'ntc',
    title: 'HeatFlip · NTC characteristic',
    loadComponent: () => import('./pages/ntc/ntc').then(m => m.NtcPage),
  },
  {
    path: 'modbus',
    title: 'HeatFlip · Modbus RTU',
    loadComponent: () => import('./pages/modbus/modbus').then(m => m.ModbusPage),
  },
  {
    path: 'regenerator',
    title: 'HeatFlip · Ceramic regenerator',
    loadComponent: () => import('./pages/regenerator/regenerator').then(m => m.RegeneratorPage),
  },
  { path: '**', redirectTo: '' },
];
