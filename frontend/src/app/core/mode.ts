import { Injectable, computed, signal } from '@angular/core';

import { CalcMode, CopParams, DEFAULT_COP } from './models';

/** How heat and COP are computed on every analysis page: as the scripts did, or with their slips fixed. */
@Injectable({ providedIn: 'root' })
export class Mode {
  readonly mode = signal<CalcMode>('scripts');
  readonly cop = computed<CopParams>(() => ({ ...DEFAULT_COP, mode: this.mode() }));
  /** factor in Q = flow · Δi */
  readonly flow = computed(() => (this.mode() === 'corrected' ? 0.468 : 0.389));
}
