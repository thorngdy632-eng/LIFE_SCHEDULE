import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Task } from '../../core/models/models';
import { TaskActionsService } from '../../core/services/task-actions.service';
import { isOverdue } from '../../core/utils/task-utils';
import { formatShort } from '../../core/utils/date';
import { IconComponent } from './icon.component';
import { PriorityBadgeComponent, StatusBadgeComponent } from './badges.component';

@Component({
  selector: 'app-task-row',
  imports: [IconComponent, StatusBadgeComponent, PriorityBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="task-row" [class.done]="task().status === 'Completed'" [class.cancelled]="task().status === 'Cancelled'" [class.overdue]="overdue()">
      <button class="check" type="button" [attr.aria-label]="task().status === 'Completed' ? 'Mark ' + task().title + ' as pending' : 'Complete ' + task().title"
        [attr.aria-pressed]="task().status === 'Completed'" [disabled]="task().status === 'Cancelled'" (click)="actions.toggleComplete(task())">
        <app-icon [name]="task().status === 'Completed' ? 'circle-check' : 'circle'" [size]="22" />
      </button>
      <div class="task-main">
        <div class="task-title">{{ task().title }}</div>
        <div class="task-meta">
          @if (showDate()) { <span><app-icon name="calendar-days" [size]="14" />{{ dateLabel() }}</span> }
          @if (task().startTime) { <span><app-icon name="clock" [size]="14" />{{ task().startTime }}@if (task().endTime) {  to {{ task().endTime }} }</span> }
          <span>{{ task().category }}</span>
          @if (task().phase !== 'General') { <span class="phase" [class]="'phase ' + task().phase.toLowerCase()">{{ task().phase }}</span> }
          @if (task().location) { <span><app-icon name="map-pin" [size]="14" />{{ task().location }}</span> }
        </div>
      </div>
      <div class="task-badges"><app-priority-badge [priority]="task().priority" /><app-status-badge [status]="task().status" [overdue]="overdue()" /></div>
      <div class="task-actions">
        <button class="icon-btn" type="button" [attr.aria-label]="'Edit ' + task().title" title="Edit" (click)="actions.edit(task())"><app-icon name="pencil" [size]="16" /></button>
        <button class="icon-btn danger" type="button" [attr.aria-label]="'Delete ' + task().title" title="Delete" (click)="actions.remove(task())"><app-icon name="trash" [size]="16" /></button>
      </div>
    </div>`,
})
export class TaskRowComponent {
  readonly task = input.required<Task>();
  readonly showDate = input(false);
  protected actions = inject(TaskActionsService);
  protected overdue = computed(() => isOverdue(this.task()));
  protected dateLabel = computed(() => formatShort(this.task().date));
}
