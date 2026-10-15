import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { IconComponent } from './icon.component';

interface ConfirmState { title: string; message: string; confirmLabel: string; resolve: (v: boolean) => void }

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);
  ask(title: string, message: string, confirmLabel = 'Delete'): Promise<boolean> {
    return new Promise((resolve) => this.state.set({ title, message, confirmLabel, resolve }));
  }
  close(v: boolean) { this.state()?.resolve(v); this.state.set(null); }
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'svc.state() && svc.close(false)' },
  template: `
    @if (svc.state(); as s) {
      <div class="overlay" (click)="svc.close(false)">
        <div class="dialog narrow" role="alertdialog" aria-modal="true" aria-labelledby="cfm-title" (click)="$event.stopPropagation()">
          <div class="dialog-icon danger"><app-icon name="warning" [size]="22" /></div>
          <h2 id="cfm-title">{{ s.title }}</h2>
          <p class="muted">{{ s.message }}</p>
          <div class="dialog-actions">
            <button class="btn" type="button" (click)="svc.close(false)">Cancel</button>
            <button class="btn danger" type="button" (click)="svc.close(true)">{{ s.confirmLabel }}</button>
          </div>
        </div>
      </div>
    }`,
})
export class ConfirmDialogComponent { protected svc = inject(ConfirmService); }
