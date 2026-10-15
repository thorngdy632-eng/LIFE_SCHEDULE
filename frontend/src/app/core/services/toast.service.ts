import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; text: string }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private n = 0;
  success(text: string) { this.push('success', text, 3500); }
  error(text: string) { this.push('error', text, 7000); }
  info(text: string) { this.push('info', text, 4000); }
  dismiss(id: number) { this.toasts.update((l) => l.filter((t) => t.id !== id)); }
  private push(kind: Toast['kind'], text: string, ms: number) {
    const id = ++this.n;
    this.toasts.update((l) => [...l, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
