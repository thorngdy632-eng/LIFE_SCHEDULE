import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { TaskActionsService } from '../../core/services/task-actions.service';
import { Task } from '../../core/models/models';
import { addDays, formatLong, fromMinutes, minutes, nowTime, todayIso } from '../../core/utils/date';
import { byTime, isOverdue } from '../../core/utils/task-utils';
import { IconComponent } from '../../shared/components/icon.component';
import { StatePanelComponent } from '../../shared/components/state-panel.component';
import { TaskRowComponent } from '../../shared/components/task-row.component';

const HOUR_PX = 60;
type View = 'timeline' | 'list' | 'agenda';
interface Placed { task: Task; top: number; height: number; col: number; cols: number }

/** Assigns side-by-side columns to overlapping tasks so none is hidden. */
function layout(tasks: Task[], startHour: number): Placed[] {
  const items = tasks.filter((t) => t.startTime).map((t) => {
    const s = minutes(t.startTime), e = t.endTime ? minutes(t.endTime) : s + 30;
    return { task: t, s, e: Math.max(e, s + 20) };
  }).sort((a, b) => a.s - b.s || a.e - b.e);
  const out: Placed[] = [];
  let cluster: { task: Task; s: number; e: number; col: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) out.push({ task: c.task, top: ((c.s - startHour * 60) / 60) * HOUR_PX, height: ((c.e - c.s) / 60) * HOUR_PX, col: c.col, cols });
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) { flush(); clusterEnd = -1; }
    const used = new Set(cluster.filter((c) => c.e > it.s).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...it, col });
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  flush();
  return out;
}

@Component({
  selector: 'app-schedule',
  imports: [IconComponent, StatePanelComponent, TaskRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './schedule.component.scss',
  template: `
    <div class="page-actions">
      <div class="date-nav" role="group" aria-label="Select date">
        <button class="icon-btn" type="button" aria-label="Previous day" (click)="shift(-1)"><app-icon name="chevron-left" /></button>
        <input type="date" [value]="date()" (change)="setDate($any($event.target).value)" aria-label="Date" />
        <button class="icon-btn" type="button" aria-label="Next day" (click)="shift(1)"><app-icon name="chevron-right" /></button>
      </div>
      <button class="btn" type="button" [disabled]="date() === today" (click)="date.set(today)">Jump to today</button>
      <strong class="day-label">{{ longDate() }}</strong>
      <div class="seg spacer" role="group" aria-label="View">
        <button type="button" [class.on]="view() === 'timeline'" (click)="view.set('timeline')">Timeline</button>
        <button type="button" [class.on]="view() === 'list'" (click)="view.set('list')">List</button>
        <button type="button" [class.on]="view() === 'agenda'" (click)="view.set('agenda')">Agenda</button>
      </div>
      <button class="btn primary" type="button" (click)="actions.create({ date: date() })"><app-icon name="plus" [size]="16" />Quick add</button>
    </div>

    @if (loading()) {
      <app-state-panel kind="loading" title="Loading schedule" />
    } @else if (error()) {
      <app-state-panel kind="error" title="Schedule could not load" [message]="error()" actionLabel="Try again" (action)="load()" />
    } @else if (tasks().length === 0) {
      <section class="card"><app-state-panel kind="empty" iconName="calendar-clock" title="Nothing scheduled for this day" message="Add a task to plan the hours ahead." actionLabel="Add task" (action)="actions.create({ date: date() })" /></section>
    } @else {
      @if (view() === 'timeline') {
        @if (unscheduled().length) {
          <section class="card unscheduled">
            <div class="card-head"><h2>No set time</h2></div>
            <div class="task-list">@for (t of unscheduled(); track t.id) { <app-task-row [task]="t" /> }</div>
          </section>
        }
        <section class="card tl-card">
          <div class="tl" [style.height.px]="(endHour() - startHour()) * hourPx">
            @for (h of hours(); track h) {
              <div class="hour" [style.top.px]="(h - startHour()) * hourPx">
                <span class="hour-label tnum">{{ pad(h) }}:00</span>
                <button type="button" class="slot" [attr.aria-label]="'Add task at ' + pad(h) + ':00'" (click)="actions.create({ date: date(), startTime: pad(h) + ':00' })"></button>
              </div>
            }
            @for (p of placed(); track p.task.id) {
              <button type="button" class="block" [class]="'block ' + tone(p.task)" [style.top.px]="p.top" [style.height.px]="p.height"
                [style.left]="'calc(64px + (100% - 72px) * ' + p.col / p.cols + ')'" [style.width]="'calc((100% - 72px) / ' + p.cols + ' - 4px)'"
                (click)="actions.edit(p.task)" [attr.aria-label]="'Edit ' + p.task.title + ' ' + p.task.startTime">
                <span class="b-title">{{ p.task.title }}</span>
                <span class="b-time tnum">{{ p.task.startTime }}@if (p.task.endTime) { to {{ p.task.endTime }} }</span>
              </button>
            }
            @if (nowTop() !== null) { <div class="now-line" [style.top.px]="nowTop()"><span class="tnum">{{ now() }}</span></div> }
          </div>
        </section>
      }
      @if (view() === 'list') {
        <section class="card"><div class="task-list">@for (t of tasks(); track t.id) { <app-task-row [task]="t" /> }</div></section>
      }
      @if (view() === 'agenda') {
        <div class="agenda">
          @for (g of groups(); track g.key) {
            <section class="card">
              <div class="card-head"><h2>{{ g.title }}</h2><span class="muted tnum">{{ g.items.length }}</span></div>
              @if (g.items.length) { <div class="task-list">@for (t of g.items; track t.id) { <app-task-row [task]="t" /> }</div> }
              @else { <p class="card-body muted">{{ g.empty }}</p> }
            </section>
          }
        </div>
      }
    }
  `,
})
export class ScheduleComponent {
  private api = inject(ApiService);
  private refresh = inject(DataRefreshService);
  protected actions = inject(TaskActionsService);

  protected today = todayIso();
  protected hourPx = HOUR_PX;
  protected date = signal(todayIso());
  protected view = signal<View>('timeline');
  protected loading = signal(true);
  protected error = signal('');
  protected tasks = signal<Task[]>([]);
  protected now = signal(nowTime());

  protected longDate = computed(() => formatLong(this.date()));
  protected unscheduled = computed(() => this.tasks().filter((t) => !t.startTime));
  protected startHour = computed(() => {
    const starts = this.tasks().filter((t) => t.startTime).map((t) => Math.floor(minutes(t.startTime) / 60));
    return Math.max(0, Math.min(7, ...starts));
  });
  protected endHour = computed(() => {
    const ends = this.tasks().filter((t) => t.startTime).map((t) => Math.ceil(minutes(t.endTime || fromMinutes(minutes(t.startTime) + 30)) / 60));
    return Math.min(24, Math.max(20, ...ends) + 1);
  });
  protected hours = computed(() => Array.from({ length: this.endHour() - this.startHour() }, (_, i) => this.startHour() + i));
  protected placed = computed(() => layout(this.tasks(), this.startHour()));
  protected nowTop = computed(() => {
    if (this.date() !== this.today) return null;
    const m = minutes(this.now());
    return m < this.startHour() * 60 || m > this.endHour() * 60 ? null : ((m - this.startHour() * 60) / 60) * HOUR_PX;
  });
  protected groups = computed(() => {
    const day = this.date(), n = this.now(), today = this.today;
    const timed = (t: Task) => t.startTime;
    const isNow = (t: Task) => day === today && !!timed(t) && t.startTime <= n && (t.endTime ? t.endTime > n : false);
    const earlier = (t: Task) => (day < today) || (day === today && !!timed(t) && !isNow(t) && (t.endTime || t.startTime) <= n);
    const items = this.tasks();
    const nowItems = items.filter(isNow);
    const before = items.filter((t) => !isNow(t) && earlier(t));
    const later = items.filter((t) => !nowItems.includes(t) && !before.includes(t));
    return [
      { key: 'before', title: 'Earlier', items: before, empty: 'Nothing earlier in the day.' },
      { key: 'now', title: 'Happening now', items: nowItems, empty: day === today ? 'No task is running right now.' : 'Only applies to today.' },
      { key: 'after', title: 'Later', items: later, empty: 'Nothing left for this day.' },
    ];
  });

  constructor() {
    effect(() => { this.date(); this.refresh.version(); this.load(); });
    const id = setInterval(() => this.now.set(nowTime()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  protected load() {
    this.error.set('');
    this.api.listTasks({ date: this.date() }).subscribe({
      next: (t) => { this.tasks.set(t.filter((x) => x.status !== 'Cancelled').sort(byTime)); this.loading.set(false); },
      error: (e: Error) => { this.error.set(e.message); this.loading.set(false); },
    });
  }

  protected shift(n: number) { this.date.set(addDays(this.date(), n)); }
  protected setDate(v: string) { if (v) this.date.set(v); }
  protected pad = (n: number) => String(n).padStart(2, '0');
  protected tone(t: Task) { return t.status === 'Completed' ? 'done' : isOverdue(t) ? 'overdue' : t.status === 'In Progress' ? 'progress' : ''; }
}
