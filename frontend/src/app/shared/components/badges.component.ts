import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

const STATUS: Record<string, { icon: IconName; cls: string }> = {
  Pending: { icon: 'circle', cls: 'neutral' },
  'In Progress': { icon: 'play', cls: 'info' },
  Completed: { icon: 'circle-check', cls: 'success' },
  Cancelled: { icon: 'ban', cls: 'muted' },
  Planned: { icon: 'calendar-clock', cls: 'neutral' },
  Overdue: { icon: 'alert', cls: 'danger' },
};

@Component({
  selector: 'app-status-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge ' + meta().cls"><app-icon [name]="meta().icon" [size]="13" />{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  readonly overdue = input(false);
  protected readonly label = computed(() => (this.overdue() ? 'Overdue' : this.status()));
  protected readonly meta = computed(() => STATUS[this.label()] ?? STATUS['Pending']);
}

@Component({
  selector: 'app-priority-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'badge flat ' + cls()">{{ priority() }}</span>`,
})
export class PriorityBadgeComponent {
  readonly priority = input.required<string>();
  protected readonly cls = computed(() => ({ Low: 'muted', Medium: 'neutral', High: 'warn', Urgent: 'danger' } as Record<string, string>)[this.priority()] ?? 'neutral');
}
