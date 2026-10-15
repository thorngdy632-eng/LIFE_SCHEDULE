import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';
import { DataRefreshService } from './data-refresh.service';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { TaskDialogService } from '../../shared/components/task-dialog.component';
import { Task, TaskStatus } from '../models/models';

/** Shared task operations so every page behaves and reports results the same way. */
@Injectable({ providedIn: 'root' })
export class TaskActionsService {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private refresh = inject(DataRefreshService);
  private confirm = inject(ConfirmService);
  private dialog = inject(TaskDialogService);

  create(opts: Parameters<TaskDialogService['open']>[0] = {}) { return this.dialog.open(opts); }
  edit(task: Task) { return this.dialog.open({ task }); }

  setStatus(task: Task, status: TaskStatus) {
    this.api.setStatus(task.id, status).subscribe({
      next: () => { this.toast.success(status === 'Completed' ? 'Task completed' : `Task marked ${status.toLowerCase()}`); this.refresh.bump(); },
      error: (e) => this.toast.error(`Could not change the status. ${e.full ?? e.message}`),
    });
  }
  toggleComplete(task: Task) { this.setStatus(task, task.status === 'Completed' ? 'Pending' : 'Completed'); }

  async remove(task: Task) {
    const yes = await this.confirm.ask('Delete this task?', `"${task.title}" will be permanently removed. This cannot be undone.`);
    if (!yes) return;
    this.api.deleteTask(task.id).subscribe({
      next: () => { this.toast.success('Task deleted'); this.refresh.bump(); },
      error: (e) => this.toast.error(`Could not delete the task. ${e.full ?? e.message}`),
    });
  }

  reschedule(task: Task, date: string) {
    this.api.reschedule(task.id, { date, startTime: task.startTime, endTime: task.endTime }).subscribe({
      next: () => { this.toast.success('Task rescheduled'); this.refresh.bump(); },
      error: (e) => this.toast.error(`Could not reschedule. ${e.full ?? e.message}`),
    });
  }
}
