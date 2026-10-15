import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-toast-host',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-host" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class]="'toast ' + t.kind" role="status">
          <app-icon [name]="t.kind === 'success' ? 'circle-check' : t.kind === 'error' ? 'alert' : 'info'" />
          <span>{{ t.text }}</span>
          <button class="icon-btn" type="button" aria-label="Dismiss notification" (click)="toasts.dismiss(t.id)"><app-icon name="x" [size]="16" /></button>
        </div>
      }
    </div>`,
})
export class ToastHostComponent { protected toasts = inject(ToastService); }
