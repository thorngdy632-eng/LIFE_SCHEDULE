import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { TaskActionsService } from '../../core/services/task-actions.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { EVENT_STATUSES, PHASES, PlannerEvent, Phase, Task } from '../../core/models/models';
import { formatShort, todayIso } from '../../core/utils/date';
import { IconComponent } from '../../shared/components/icon.component';
import { StatePanelComponent } from '../../shared/components/state-panel.component';
import { StatusBadgeComponent } from '../../shared/components/badges.component';
import { TaskRowComponent } from '../../shared/components/task-row.component';

@Component({
  selector: 'app-events',
  imports: [ReactiveFormsModule, IconComponent, StatePanelComponent, StatusBadgeComponent, TaskRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './events.component.scss',
  template: `
    <div class="page-actions">
      <p class="muted lead">Group the work around one event into what happens before, during and after it.</p>
      <button class="btn primary spacer" type="button" (click)="openForm()"><app-icon name="plus" [size]="16" />New event</button>
    </div>

    @if (loading()) {
      <app-state-panel kind="loading" title="Loading events" />
    } @else if (error()) {
      <app-state-panel kind="error" title="Events could not load" [message]="error()" actionLabel="Try again" (action)="load()" />
    } @else if (events().length === 0) {
      <section class="card"><app-state-panel kind="empty" iconName="layers" title="No events yet" message="Create an event, then add before, during and after tasks to it." actionLabel="New event" (action)="openForm()" /></section>
    } @else {
      <div class="events">
        @for (e of events(); track e.id) {
          <article class="card event">
            <header class="event-head">
              <div class="event-title">
                <h2>{{ e.title }}</h2>
                <div class="muted meta">
                  <span><app-icon name="calendar-days" [size]="14" />{{ short(e.date) }}</span>
                  @if (e.startTime) { <span><app-icon name="clock" [size]="14" />{{ e.startTime }}@if (e.endTime) { to {{ e.endTime }} }</span> }
                  @if (e.location) { <span><app-icon name="map-pin" [size]="14" />{{ e.location }}</span> }
                </div>
                @if (e.description) { <p class="muted desc">{{ e.description }}</p> }
              </div>
              <div class="event-side">
                <app-status-badge [status]="e.status" />
                <button class="icon-btn" type="button" [attr.aria-label]="'Edit ' + e.title" title="Edit event" (click)="openForm(e)"><app-icon name="pencil" [size]="16" /></button>
                <button class="icon-btn danger" type="button" [attr.aria-label]="'Delete ' + e.title" title="Delete event" (click)="remove(e)"><app-icon name="trash" [size]="16" /></button>
              </div>
            </header>
            <div class="progress-row">
              <div class="progress" role="progressbar" [attr.aria-label]="e.title + ' progress'" [attr.aria-valuenow]="e.progress" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="e.progress"></span></div>
              <span class="tnum muted">{{ e.completedCount }} of {{ e.taskCount }} done</span>
            </div>
            <div class="phases">
              @for (p of phases; track p) {
                <section class="phase-col">
                  <div class="phase-head"><h3 [class]="'phase ' + p.toLowerCase()">{{ p }}</h3>
                    <button class="icon-btn" type="button" [attr.aria-label]="'Add ' + p + ' task to ' + e.title" title="Add task" (click)="addTask(e, p)"><app-icon name="plus" [size]="16" /></button></div>
                  @for (t of tasksIn(e, p); track t.id) { <div class="mini"><app-task-row [task]="t" /></div> }
                  @empty { <p class="muted small">No {{ p.toLowerCase() }} tasks.</p> }
                </section>
              }
            </div>
          </article>
        }
      </div>
    }

    @if (formOpen()) {
      <div class="overlay" (mousedown)="formOpen.set(false)">
        <form class="dialog wide" [formGroup]="form" (ngSubmit)="save()" (mousedown)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="ev-title" novalidate>
          <header class="dialog-head"><h2 id="ev-title">{{ editing() ? 'Edit event' : 'New event' }}</h2>
            <button class="icon-btn" type="button" aria-label="Close dialog" (click)="formOpen.set(false)"><app-icon name="x" /></button></header>
          <div class="form-grid">
            <label class="field span-2">Title<input type="text" formControlName="title" maxlength="200" [class.invalid]="form.controls.title.touched && form.controls.title.invalid" />
              @if (form.controls.title.touched && form.controls.title.invalid) { <span class="field-error">Enter a title.</span> }</label>
            <label class="field span-2">Description<textarea rows="2" formControlName="description"></textarea></label>
            <label class="field">Date<input type="date" formControlName="date" /></label>
            <div class="field-pair"><label class="field">Start<input type="time" formControlName="startTime" /></label><label class="field">End<input type="time" formControlName="endTime" /></label></div>
            <label class="field">Location<input type="text" formControlName="location" /></label>
            <label class="field">Status<select formControlName="status">@for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }</select></label>
          </div>
          @if (form.errors?.['endBeforeStart']) { <p class="form-error" role="alert">End time must be later than start time.</p> }
          @if (formError()) { <p class="form-error" role="alert"><app-icon name="alert" [size]="16" /> {{ formError() }}</p> }
          <footer class="dialog-actions"><button class="btn" type="button" (click)="formOpen.set(false)">Cancel</button>
            <button class="btn primary" type="submit">{{ editing() ? 'Save changes' : 'Create event' }}</button></footer>
        </form>
      </div>
    }
  `,
})
export class EventsComponent {
  private api = inject(ApiService);
  private refresh = inject(DataRefreshService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private actions = inject(TaskActionsService);
  private fb = inject(FormBuilder).nonNullable;

  protected phases = PHASES.filter((p) => p !== 'General') as Phase[];
  protected statuses = EVENT_STATUSES;
  protected events = signal<PlannerEvent[]>([]);
  protected loading = signal(true);
  protected error = signal('');
  protected formOpen = signal(false);
  protected editing = signal<PlannerEvent | null>(null);
  protected formError = signal('');

  protected form = this.fb.group({
    title: ['', Validators.required], description: [''], date: [todayIso(), Validators.required],
    startTime: [''], endTime: [''], location: [''], status: ['Planned'],
  }, { validators: (g) => { const s = g.get('startTime')?.value, e = g.get('endTime')?.value; return s && e && e <= s ? { endBeforeStart: true } : null; } });

  constructor() { effect(() => { this.refresh.version(); this.load(); }); }

  protected short = formatShort;
  protected tasksIn(e: PlannerEvent, p: Phase): Task[] {
    return e.tasks.filter((t) => t.phase === p).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  }

  protected load() {
    this.error.set('');
    this.api.listEvents().subscribe({
      next: (e) => { this.events.set(e); this.loading.set(false); },
      error: (e: Error) => { this.error.set(e.message); this.loading.set(false); },
    });
  }

  protected addTask(e: PlannerEvent, phase: Phase) { this.actions.create({ eventId: e.id, phase, date: e.date }); }

  protected openForm(e?: PlannerEvent) {
    this.editing.set(e ?? null);
    this.formError.set('');
    this.form.reset({
      title: e?.title ?? '', description: e?.description ?? '', date: e?.date ?? todayIso(), startTime: e?.startTime ?? '',
      endTime: e?.endTime ?? '', location: e?.location ?? '', status: e?.status ?? 'Planned',
    });
    this.formOpen.set(true);
  }

  protected save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const body = this.form.getRawValue() as never;
    const ed = this.editing();
    (ed ? this.api.updateEvent(ed.id, body) : this.api.createEvent(body)).subscribe({
      next: () => { this.toast.success(ed ? 'Event updated' : 'Event created'); this.formOpen.set(false); this.refresh.bump(); },
      error: (e: Error & { full?: string }) => { this.formError.set(e.full ?? e.message); this.toast.error(ed ? 'Could not update the event' : 'Could not create the event'); },
    });
  }

  protected async remove(e: PlannerEvent) {
    const n = e.tasks.length;
    const yes = await this.confirm.ask('Delete this event?',
      n ? `"${e.title}" will be removed. Its ${n} linked ${n === 1 ? 'task stays' : 'tasks stay'} in your task list and ${n === 1 ? 'is' : 'are'} unlinked from the event.` : `"${e.title}" will be permanently removed.`);
    if (!yes) return;
    this.api.deleteEvent(e.id, false).subscribe({
      next: () => { this.toast.success('Event deleted'); this.refresh.bump(); },
      error: (er: Error) => this.toast.error(`Could not delete the event. ${er.message}`),
    });
  }
}
