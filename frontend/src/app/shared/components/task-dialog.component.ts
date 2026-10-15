import { ChangeDetectionStrategy, Component, Injectable, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { CATEGORIES, PHASES, PRIORITIES, PlannerEvent, TASK_STATUSES, Task, TaskInput } from '../../core/models/models';
import { fromMinutes, minutes, todayIso } from '../../core/utils/date';
import { IconComponent } from './icon.component';

export interface TaskDialogOptions { task?: Task; date?: string; eventId?: string; phase?: Task['phase']; startTime?: string }
interface DialogState extends TaskDialogOptions { resolve: (t: Task | null) => void }

@Injectable({ providedIn: 'root' })
export class TaskDialogService {
  readonly state = signal<DialogState | null>(null);
  open(options: TaskDialogOptions = {}): Promise<Task | null> {
    return new Promise((resolve) => this.state.set({ ...options, resolve }));
  }
  close(t: Task | null) { this.state()?.resolve(t); this.state.set(null); }
}

function timeOrder(g: AbstractControl): ValidationErrors | null {
  const s = g.get('startTime')?.value as string, e = g.get('endTime')?.value as string;
  if (e && !s) return { endWithoutStart: true };
  if (s && e && e <= s) return { endBeforeStart: true };
  return null;
}

@Component({
  selector: 'app-task-dialog',
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'svc.state() && cancel()' },
  template: `
    @if (svc.state(); as s) {
      <div class="overlay" (mousedown)="cancel()">
        <form class="dialog wide" [formGroup]="form" (ngSubmit)="save()" (mousedown)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="td-title" novalidate>
          <header class="dialog-head">
            <h2 id="td-title">{{ s.task ? 'Edit task' : 'New task' }}</h2>
            <button class="icon-btn" type="button" aria-label="Close dialog" (click)="cancel()"><app-icon name="x" /></button>
          </header>

          <div class="form-grid">
            <label class="field span-2">Title
              <input type="text" formControlName="title" maxlength="200" autocomplete="off" [class.invalid]="show('title')" />
              @if (show('title')) { <span class="field-error">Enter a title.</span> }
            </label>
            <label class="field span-2">Description
              <textarea rows="2" formControlName="description"></textarea>
            </label>

            <label class="field">Date
              <input type="date" formControlName="date" [class.invalid]="show('date')" />
              @if (show('date')) { <span class="field-error">Choose a date.</span> }
            </label>
            <div class="field-pair">
              <label class="field">Start
                <input type="time" formControlName="startTime" (change)="suggestEnd()" />
              </label>
              <label class="field">End
                <input type="time" formControlName="endTime" [class.invalid]="form.errors" />
              </label>
            </div>
            @if (form.errors?.['endBeforeStart']) { <span class="field-error span-2">End time must be later than start time.</span> }
            @if (form.errors?.['endWithoutStart']) { <span class="field-error span-2">Add a start time or clear the end time.</span> }

            <label class="field">Category
              <select formControlName="category">@for (c of categories; track c) { <option [value]="c">{{ c }}</option> }</select>
            </label>
            <label class="field">Priority
              <select formControlName="priority">@for (p of priorities; track p) { <option [value]="p">{{ p }}</option> }</select>
            </label>
            <label class="field">Status
              <select formControlName="status">@for (st of statuses; track st) { <option [value]="st">{{ st }}</option> }</select>
            </label>
            <label class="field">Phase
              <select formControlName="phase">@for (p of phases; track p) { <option [value]="p">{{ p }}</option> }</select>
            </label>
            <label class="field span-2">Linked event
              <select formControlName="eventId">
                <option value="">None</option>
                @for (e of events(); track e.id) { <option [value]="e.id">{{ e.title }} ({{ e.date }})</option> }
              </select>
            </label>
            <label class="field">Location<input type="text" formControlName="location" autocomplete="off" /></label>
            <label class="field">Reminder<input type="datetime-local" formControlName="reminderAt" /></label>
            <label class="field span-2">Notes<textarea rows="2" formControlName="notes"></textarea></label>
          </div>

          @if (error()) { <p class="form-error" role="alert"><app-icon name="alert" [size]="16" /> {{ error() }}</p> }

          <footer class="dialog-actions">
            <button class="btn" type="button" (click)="cancel()">Cancel</button>
            <button class="btn primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving' : s.task ? 'Save changes' : 'Create task' }}</button>
          </footer>
        </form>
      </div>
    }`,
})
export class TaskDialogComponent {
  protected svc = inject(TaskDialogService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private refresh = inject(DataRefreshService);
  private fb = inject(FormBuilder).nonNullable;

  protected categories = CATEGORIES; protected priorities = PRIORITIES; protected statuses = TASK_STATUSES; protected phases = PHASES;
  protected events = signal<PlannerEvent[]>([]);
  protected saving = signal(false);
  protected error = signal('');

  protected form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''], date: [todayIso(), Validators.required], startTime: [''], endTime: [''],
    category: ['Other'], priority: ['Medium'], status: ['Pending'], phase: ['General'], eventId: [''],
    location: [''], reminderAt: [''], notes: [''],
  }, { validators: timeOrder });

  constructor() {
    effect(() => {
      const s = this.svc.state();
      if (!s) return;
      this.error.set('');
      this.saving.set(false);
      const t = s.task;
      this.form.reset({
        title: t?.title ?? '', description: t?.description ?? '', date: t?.date ?? s.date ?? todayIso(),
        startTime: t?.startTime ?? s.startTime ?? '', endTime: t?.endTime ?? '',
        category: t?.category ?? 'Other', priority: t?.priority ?? 'Medium', status: t?.status ?? 'Pending',
        phase: t?.phase ?? s.phase ?? 'General', eventId: t?.eventId ?? s.eventId ?? '',
        location: t?.location ?? '', reminderAt: t?.reminderAt ? t.reminderAt.slice(0, 16) : '', notes: t?.notes ?? '',
      });
      this.api.listEvents().subscribe({ next: (e) => this.events.set(e), error: () => this.events.set([]) });
    });
  }

  protected show(name: string) { const c = this.form.get(name); return !!c && c.invalid && (c.touched || this.form.touched); }

  protected suggestEnd() {
    const { startTime, endTime } = this.form.getRawValue();
    if (startTime && !endTime) this.form.patchValue({ endTime: fromMinutes(Math.min(minutes(startTime) + 60, 23 * 60 + 59)) });
  }

  protected cancel() { this.svc.close(null); }

  protected save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const body: TaskInput = {
      title: v.title.trim(), description: v.description, date: v.date, startTime: v.startTime, endTime: v.endTime,
      category: v.category as Task['category'], priority: v.priority as Task['priority'], status: v.status as Task['status'],
      phase: v.phase as Task['phase'], eventId: v.eventId || null, goalId: this.svc.state()?.task?.goalId ?? null,
      location: v.location, reminderAt: v.reminderAt ? new Date(v.reminderAt).toISOString() : null, notes: v.notes,
    };
    const existing = this.svc.state()?.task;
    this.saving.set(true);
    (existing ? this.api.updateTask(existing.id, body) : this.api.createTask(body)).subscribe({
      next: (t) => {
        this.toast.success(existing ? 'Task updated' : 'Task created');
        this.refresh.bump();
        this.svc.close(t);
      },
      error: (e: Error & { full?: string }) => {
        this.saving.set(false);
        this.error.set(e.full ?? e.message);
        this.toast.error(existing ? 'Could not update the task' : 'Could not create the task');
      },
    });
  }
}
