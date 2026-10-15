import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { IconComponent, IconName } from '../shared/components/icon.component';
import { ToastHostComponent } from '../shared/components/toast-host.component';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog.component';
import { TaskDialogComponent } from '../shared/components/task-dialog.component';
import { ThemeService } from '../core/services/theme.service';
import { ApiService } from '../core/services/api.service';
import { DataRefreshService } from '../core/services/data-refresh.service';
import { formatLong, todayIso } from '../core/utils/date';

interface NavItem { path: string; label: string; icon: IconName }

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, ToastHostComponent, ConfirmDialogComponent, TaskDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private router = inject(Router);
  protected theme = inject(ThemeService);
  private api = inject(ApiService);
  private refresh = inject(DataRefreshService);

  protected nav: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
    { path: '/tasks', label: 'My Tasks', icon: 'list-todo' },
    { path: '/schedule', label: 'My Schedule', icon: 'calendar-clock' },
    { path: '/calendar', label: 'Calendar', icon: 'calendar-days' },
    { path: '/events', label: 'Event Planner', icon: 'layers' },
    { path: '/history', label: 'Task History', icon: 'history' },
    { path: '/journal', label: 'Daily Journal', icon: 'book-open' },
    { path: '/goals', label: 'Goals', icon: 'target' },
    { path: '/reports', label: 'Reports & Analytics', icon: 'chart' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  protected collapsed = signal(false);
  protected mobileOpen = signal(false);
  protected overdue = signal(0);
  protected today = formatLong(todayIso());

  private url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });
  protected title = computed(() => this.nav.find((n) => this.url().startsWith(n.path))?.label ?? 'LIFE SCHEDULE');

  constructor() {
    effect(() => {
      this.url();
      this.mobileOpen.set(false);
    });
    effect(() => {
      this.refresh.version();
      this.api.stats().subscribe({ next: (s) => this.overdue.set(s.overdue), error: () => this.overdue.set(0) });
    });
  }

  protected search(q: string) {
    const v = q.trim();
    if (v) this.router.navigate(['/tasks'], { queryParams: { q: v } });
  }
  protected openOverdue() { this.router.navigate(['/tasks'], { queryParams: { view: 'overdue' } }); }
}
