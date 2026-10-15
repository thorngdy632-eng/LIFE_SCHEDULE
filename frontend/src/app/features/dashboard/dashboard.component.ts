import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { TaskActionsService } from '../../core/services/task-actions.service';
import { Stats, Task } from '../../core/models/models';
import { addDays, formatDateTime, formatLong, formatWeekday, nowTime, todayIso } from '../../core/utils/date';
import { byTime, isOverdue } from '../../core/utils/task-utils';
import { IconComponent, IconName } from '../../shared/components/icon.component';
import { StatePanelComponent } from '../../shared/components/state-panel.component';
import { TaskRowComponent } from '../../shared/components/task-row.component';

interface Card { label: string; value: string; icon: IconName; tone: string }

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, IconComponent, StatePanelComponent, TaskRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.component.scss',
  template: `
    <div class="page-actions">
      <div class="date-nav" role="group" aria-label="Select date">
        <button class="icon-btn" type="button" aria-label="Previous day" (click)="shift(-1)"><app-icon name="chevron-left" /></button>
        <input type="date" [value]="date()" (change)="setDate($any($event.target).value)" aria-label="Date" />
        <button class="icon-btn" type="button" aria-label="Next day" (click)="shift(1)"><app-icon name="chevron-right" /></button>
      </div>
      @if (date() !== today) { <button class="btn" type="button" (click)="date.set(today)">Today</button> }
      <span class="muted">{{ longDate() }}</span>
      <button class="btn primary spacer" type="button" (click)="actions.create({ date: date() })"><app-icon name="plus" [size]="16" />Add task</button>
    </div>

    @if (loading()) {
      <app-state-panel kind="loading" title="Loading your day" />
    } @else if (error()) {
      <app-state-panel kind="error" title="Dashboard could not load" [message]="error()" actionLabel="Try again" (action)="load()" />
    } @else if (stats(); as s) {
      <section class="cards" aria-label="Summary">
        @for (c of cards(); track c.label) {
          <div class="card stat" [class]="'card stat ' + c.tone">
            <span class="stat-icon"><app-icon [name]="c.icon" /></span>
            <div><div class="stat-value tnum">{{ c.value }}</div><div class="stat-label">{{ c.label }}</div></div>
          </div>
        }
      </section>

      <div class="layout">
        <section class="card span-main">
          <div class="card-head"><h2>Schedule for this day</h2><a class="btn sm" routerLink="/schedule">Open schedule</a></div>
          @if (dayTasks().length === 0) {
            <app-state-panel kind="empty" title="Nothing planned" message="Add a task to start building this day." actionLabel="Add task" (action)="actions.create({ date: date() })" />
          } @else {
            <ol class="timeline">
              @for (t of dayTasks(); track t.id) {
                <li [class.now]="isNext(t)">
                  <span class="time tnum">{{ t.startTime || 'Any time' }}</span>
                  <span class="rail" aria-hidden="true"></span>
                  <div class="tl-body"><app-task-row [task]="t" /></div>
                </li>
              }
            </ol>
          }
        </section>

        <aside class="side">
          <section class="card">
            <div class="card-head"><h2>Daily goal</h2><span class="tnum muted">{{ s.completed }} of {{ s.totalToday }}</span></div>
            <div class="card-body">
              <div class="progress" role="progressbar" aria-label="Daily completion" [attr.aria-valuenow]="s.completionRate" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="s.completionRate"></span></div>
              <p class="muted small">{{ s.totalToday ? s.completionRate + '% of this day\\'s tasks are complete.' : 'No tasks on this day yet.' }}</p>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2>Last 7 days</h2></div>
            <div class="card-body">
              @if (weekHasData()) {
                <div class="bars" role="img" [attr.aria-label]="'Completion rate for the 7 days ending ' + s.date">
                  @for (d of s.week; track d.date) {
                    <div class="bar-col" [title]="d.completed + ' of ' + d.total + ' completed'">
                      <div class="bar-track"><span [style.height.%]="d.total ? d.rate : 0" [class.empty]="!d.total"></span></div>
                      <span class="bar-label">{{ weekday(d.date) }}</span>
                    </div>
                  }
                </div>
              } @else { <p class="muted small">No tasks recorded in this period.</p> }
            </div>
          </section>
        </aside>

        <section class="card">
          <div class="card-head"><h2>Upcoming tasks</h2><a class="btn sm" routerLink="/tasks">All tasks</a></div>
          @if (upcoming().length) { <div class="task-list">@for (t of upcoming(); track t.id) { <app-task-row [task]="t" [showDate]="true" /> }</div> }
          @else { <p class="card-body muted">No open tasks after this moment.</p> }
        </section>

        <section class="card">
          <div class="card-head"><h2>Recently completed</h2></div>
          @if (recent().length) {
            <ul class="recent">
              @for (t of recent(); track t.id) {
                <li><app-icon name="circle-check" [size]="18" /><span class="r-title">{{ t.title }}</span><span class="muted small">{{ when(t.completedAt) }}</span></li>
              }
            </ul>
          } @else { <p class="card-body muted">Completed tasks will appear here.</p> }
        </section>
      </div>
    }
  `,
})
export class DashboardComponent {
  private api = inject(ApiService);
  private refresh = inject(DataRefreshService);
  protected actions = inject(TaskActionsService);

  protected today = todayIso();
  protected date = signal(todayIso());
  protected loading = signal(true);
  protected error = signal('');
  protected stats = signal<Stats | null>(null);
  protected dayTasks = signal<Task[]>([]);
  protected upcoming = signal<Task[]>([]);
  protected recent = signal<Task[]>([]);

  protected longDate = computed(() => formatLong(this.date()));
  protected weekHasData = computed(() => (this.stats()?.week ?? []).some((d) => d.total > 0));
  protected cards = computed<Card[]>(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: 'Tasks', value: String(s.totalToday), icon: 'list-todo', tone: '' },
      { label: 'Completed', value: String(s.completed), icon: 'circle-check', tone: 'success' },
      { label: 'Pending', value: String(s.pending), icon: 'clock', tone: '' },
      { label: 'In progress', value: String(s.inProgress), icon: 'play', tone: 'info' },
      { label: 'Overdue', value: String(s.overdue), icon: 'alert', tone: s.overdue ? 'danger' : '' },
      { label: 'Completion', value: `${s.completionRate}%`, icon: 'target', tone: 'info' },
    ];
  });

  constructor() {
    effect(() => { this.date(); this.refresh.version(); this.load(); });
  }

  protected load() {
    const date = this.date();
    this.error.set('');
    forkJoin({
      stats: this.api.stats(date),
      day: this.api.listTasks({ date }),
      open: this.api.listTasks({ from: date }),
      done: this.api.listTasks({ status: 'Completed' }),
    }).subscribe({
      next: ({ stats, day, open, done }) => {
        this.stats.set(stats);
        this.dayTasks.set(day.filter((t) => t.status !== 'Cancelled').sort(byTime));
        const now = nowTime(), today = todayIso();
        this.upcoming.set(open.filter((t) => (t.status === 'Pending' || t.status === 'In Progress') && !isOverdue(t, today, now) &&
          (t.date > today || t.date === today && (!t.startTime || t.startTime >= now))).sort(byTime).slice(0, 5));
        this.recent.set(done.filter((t) => t.completedAt).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 5));
        this.loading.set(false);
      },
      error: (e: Error) => { this.error.set(e.message); this.loading.set(false); },
    });
  }

  protected shift(n: number) { this.date.set(addDays(this.date(), n)); }
  protected setDate(v: string) { if (v) this.date.set(v); }
  protected weekday = formatWeekday;
  protected when = (iso: string | null) => (iso ? formatDateTime(iso) : '');
  protected isNext(t: Task) { return this.date() === this.today && t === this.dayTasks().find((x) => x.status !== 'Completed' && (x.startTime || '') >= nowTime()); }
}
