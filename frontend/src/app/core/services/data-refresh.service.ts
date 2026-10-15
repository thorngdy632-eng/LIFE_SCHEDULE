import { Injectable, signal } from '@angular/core';

/** Bumped after any mutation so pages that display tasks can reload. */
@Injectable({ providedIn: 'root' })
export class DataRefreshService {
  readonly version = signal(0);
  bump() { this.version.update((v) => v + 1); }
}
