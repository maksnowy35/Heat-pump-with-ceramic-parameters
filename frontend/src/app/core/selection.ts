import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { catchError, of } from 'rxjs';

import { Api } from './api';
import { Datasets } from './datasets';
import { Candidate } from './models';

/** The window the analysis pages share, and the steady windows proposed for the selected record. */
@Injectable({ providedIn: 'root' })
export class Selection {
  private api = inject(Api);
  private ds = inject(Datasets);

  readonly start = signal('2025-02-22T08:24:58');
  readonly minutes = signal(30);
  readonly suggestions = signal<Candidate[]>([]);

  private loadedFor = '';

  constructor() {
    effect(() => {
      const d = this.ds.selected();
      if (!d) return;
      const key = `${d.id}|${d.rows}|${d.missing_flags}`;
      if (key === this.loadedFor) return;
      const first = this.loadedFor === '' || this.loadedFor.split('|')[0] !== d.id;
      this.loadedFor = key;
      this.api.suggestWindows(d.id).pipe(catchError(() => of([] as Candidate[]))).subscribe(list => {
        this.suggestions.set(list);
        // a record that does not contain the current window starts at its first steady window
        const s = untracked(this.start);
        if (first && list.length && (s < d.start.slice(0, 19) || s > d.end.slice(0, 19))) this.start.set(list[0].start);
      });
    });
  }

  use(start: string, minutes?: number): void {
    this.start.set(start.slice(0, 19));
    if (minutes) this.minutes.set(minutes);
  }
}
