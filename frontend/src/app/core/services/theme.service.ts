import { Injectable, signal } from '@angular/core';

type Theme = 'light' | 'dark';

/** Theme is a per-browser preference, so localStorage is appropriate here. Records live on the server. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initial());
  constructor() { this.apply(this.theme()); }
  toggle() { const t: Theme = this.theme() === 'light' ? 'dark' : 'light'; this.theme.set(t); this.apply(t); try { localStorage.setItem('ls-theme', t); } catch { /* ignore */ } }
  private initial(): Theme {
    try { const s = localStorage.getItem('ls-theme'); if (s === 'light' || s === 'dark') return s; } catch { /* ignore */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  private apply(t: Theme) { document.documentElement.setAttribute('data-theme', t); }
}
