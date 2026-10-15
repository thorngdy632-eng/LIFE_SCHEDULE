import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { TaskActionsService } from '../../core/services/task-actions.service';
import { CATEGORIES, PHASES, PRIORITIES, TASK_STATUSES, Task } from '../../core/models/models';
import { isOverdue } from '../../core/utils/task-utils';
import { IconComponent } from '../../shared/components/icon.component';
import { StatePanelComponent } from '../../shared/components/state-panel.component';
import { TaskRowComponent } from '../../shared/components/task-row.component';

@Component({
  selector: 'app-tasks',
  imports: [FormsModule, IconComponent, StatePanelComponent, TaskRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .filters { display: grid; grid-template-columns: minmax(180px, 2fr) repeat(5, minmax(110px, 1fr)); gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--line); }
    .count { padding: 10px 18px; color: var(--ink-3); font-size: 12.5px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; }
    .seg { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 10px; overflow: hidden; }
    .seg button { border: 0; background: var(--surface); color: var(--ink-2); height: 36px; padding: 0 14px; font: inherit; font-weight: 500; cursor: pointer; }
    .seg button.on { background: var(--primary-soft); color: var(--primary); font-weight: 600; }
    @media (max-width: 900px) { .filters { grid-template-columns: 1fr 1fr; } .filters .wide { grid-column: 1 / -1; } }
  `,
  template: `
    <div class="page-actions">
      <div class="seg" role="group" aria-label="Task view">
        <button type="button" [class.on]="view() === 'all'" (click)="view.set('all')">All</button>
        <button type="button" [class.on]="view() === 'open'" (click)="view.set('open')">Open</button>
        <button type="button" [class.on]="view() === 'overdue'" (click)="view.set('overdue')">Overdue</button>
        <button type="button" [class.on]="view() === 'done'" (click)="view.set('done')">Completed</button>
      </div>
      <button class="btn primary spacer" type="button" (click)="actions.create()"><app-icon name="plus" [size]="16" />New task</button>
    </div>

    <section class="card">
      <div class="filters">
        <div class="wide"><input type="search" placeholder="Search title, notes or location" aria-label="Search tasks" [ngModel]="q()" (ngModelChange)="q.set($event)" /></div>
        <select aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)"><option value="">All statuses</option>@for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }</select>
        <select aria-label="Category" [ngModel]="category()" (ngModelChange)="category.set($event)"><option value="">All categories</option>@for (s of categories; track s) { <option [value]="s">{{ s }}</option> }</select>
        <select aria-label="Priority" [ngModel]="priority()" (ngModelChange)="priority.set($event)"><option value="">All priorities</option>@for (s of priorities; track s) { <option [value]="s">{{ s }}</option> }</select>
        <select aria-label="Phase" [ngModel]="phase()" (ngModelChange)="phase.set($event)"><option value="">All phases</option>@for (s of phases; track s) { <option [value]="s">{{ s }}</option> }</select>
        <select aria-label="Sort by" [ngModel]="sort()" (ngModelChange)="sort.set($event)">
          <option value="date">Sort by date</option><option value="priority">Sort by priority</option><option value="title">Sort by title</option><option value="status">Sort by status</option>
        </select>
      </div>

      @if (loading()) {
        <app-state-panel kind="loading" title="Loading tasks" />
      } @else if (error()) {
        <app-state-panel kind="error" title="Tasks could not load" [message]="error()" actionLabel="Try again" (action)="load()" />
      } @else if (shown().length === 0) {
        @if (filtered()) {
          <app-state-panel kind="empty" iconName="search" title="No tasks match these filters" actionLabel="Clear filters" (action)="clear()" />
        } @else {
          <app-state-panel kind="empty" title="No tasks yet" message="Create your first task to start planning." actionLabel="New task" (action)="actions.create()" />
        }
      } @else {
        <div class="count"><span>{{ shown().length }} {{ shown().length === 1 ? 'task' : 'tasks' }}</span>
          <button class="btn sm" type="button" (click)="order.set(order() === 'asc' ? 'desc' : 'asc')"><app-icon name="sort" [size]="14" />{{ order() === 'asc' ? 'Ascending' : 'Descending' }}</button></div>
        <div class="task-list">@for (t of shown(); track t.id) { <app-task-row [task]="t" [showDate]="true" /> }</div>
      }
    </section>
  `,
})
export class TasksComponent {
  private api = inject(ApiService);
  private refresh = inject(DataRefreshService);
  protected actions = inject(TaskActionsService);

  /** Bound from the query string (?q= and ?view=) via withComponentInputBinding. */
  readonly qParam = input<string | undefined>(undefined, { alias: 'q' });
  readonly viewParam = input<string | undefined>(undefined, { alias: 'view' });

  protected statuses = TASK_STATUSES; protected categories = CATEGORIES; protected priorities = PRIORITIES; protected phases = PHASES;
  protected q = signal(''); protected status = signal(''); protected category = signal(''); protected priority = signal('');
  protected phase = signal(''); protected sort = signal('date'); protected order = signal<'asc' | 'desc'>('asc');
  protected view = signal<'all' | 'open' | 'overdue' | 'done'>('all');

  protected loading = signal(true);
  protected error = signal('');
  protected tasks = signal<Task[]>([]);

  protected filtered = computed(() => !!(this.q() || this.status() || this.category() || this.priority() || this.phase()) || this.view() !== 'all');
  protected shown = computed(() => {
    const v = this.view();
    return this.tasks().filter((t) =>
      v === 'all' ? true : v === 'open' ? t.status === 'Pending' || t.status === 'In Progress' : v === 'done' ? t.status === 'Completed' : isOverdue(t));
  });

  constructor() {
    effect(() => { this.q.set(this.qParam() ?? ''); });
    effect(() => { const v = this.viewParam(); if (v === 'overdue' || v === 'open' || v === 'done') this.view.set(v); });
    effect(() => {
      this.refresh.version();
      const f = { q: this.q(), status: this.status(), category: this.category(), priority: this.priority(), phase: this.phase(), sort: this.sort(), order: this.order() };
      this.load(f);
    });
  }

  protected load(f?: Record<string, string>) {
    this.error.set('');
    this.api.listTasks((f ?? { q: this.q(), status: this.status(), category: this.category(), priority: this.priority(), phase: this.phase(), sort: this.sort(), order: this.order() }) as never).subscribe({
      next: (t) => { this.tasks.set(t); this.loading.set(false); },
      error: (e: Error) => { this.error.set(e.message); this.loading.set(false); },
    });
  }

  protected clear() { this.q.set(''); this.status.set(''); this.category.set(''); this.priority.set(''); this.phase.set(''); this.view.set('all'); }
}
