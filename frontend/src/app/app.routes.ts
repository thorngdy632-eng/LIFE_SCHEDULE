import { Routes } from '@angular/router';

const soon = (title: string) => ({ loadComponent: () => import('./features/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent), data: { title } });

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'tasks', loadComponent: () => import('./features/tasks/tasks.component').then((m) => m.TasksComponent) },
      { path: 'schedule', loadComponent: () => import('./features/schedule/schedule.component').then((m) => m.ScheduleComponent) },
      { path: 'events', loadComponent: () => import('./features/events/events.component').then((m) => m.EventsComponent) },
      { path: 'calendar', ...soon('Calendar') },
      { path: 'history', ...soon('Task History') },
      { path: 'journal', ...soon('Daily Journal') },
      { path: 'goals', ...soon('Goals') },
      { path: 'reports', ...soon('Reports & Analytics') },
      { path: 'settings', ...soon('Settings') },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
