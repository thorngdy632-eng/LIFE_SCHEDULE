import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

/** One consistent loading / error / empty block used by every page. */
@Component({
  selector: 'app-state-panel',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state-panel" [class.is-error]="kind() === 'error'" role="status">
      <app-icon [name]="icon()" [size]="26" [class.spin]="kind() === 'loading'" />
      <h3>{{ title() }}</h3>
      @if (message()) { <p>{{ message() }}</p> }
      @if (actionLabel()) { <button class="btn" type="button" (click)="action.emit()">{{ actionLabel() }}</button> }
    </div>`,
})
export class StatePanelComponent {
  readonly kind = input<'loading' | 'error' | 'empty'>('empty');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly actionLabel = input('');
  readonly iconName = input<IconName | null>(null);
  readonly action = output<void>();
  protected icon(): IconName { return this.iconName() ?? (this.kind() === 'loading' ? 'loader' : this.kind() === 'error' ? 'alert' : 'inbox'); }
}
