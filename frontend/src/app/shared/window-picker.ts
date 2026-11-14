import { Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Datasets } from '../core/datasets';
import { eventText, eventValue, fix, localInput, stamp } from '../core/format';
import { Selection } from '../core/selection';
import { WINDOWS_30, inRecord } from '../core/windows';

/** Start and length of the analysed window, with the steady windows of the record and the hand-picked ones. */
@Component({
  selector: 'app-window-picker',
  template: `
    <fieldset>
      <legend>Window</legend>
      <label class="field">
        <span>Start</span>
        <input type="datetime-local" step="1" [value]="sel.start()" (change)="setStart($event)">
      </label>
      @if (showLength()) {
        <label class="slider">
          <span>Length <b>{{ sel.minutes() }} min</b></span>
          <input type="range" min="10" max="120" step="2" [value]="sel.minutes()" (input)="sel.minutes.set(value($event))">
        </label>
      }
      <ng-content />
    </fieldset>
    @if (sel.suggestions().length) {
      <fieldset>
        <legend>Steady windows</legend>
        <div class="chips">
          @for (c of sel.suggestions(); track c.start) {
            <button type="button" class="chip" [class.on]="c.start === sel.start()" (click)="sel.use(c.start, keepLength() ? undefined : 30)"
                    [title]="stamp(c.start) + ', σ(T3) ' + fix(c.t3_std) + ' K'">
              <b>{{ fix(c.t3_mean, 1) }} °C</b> <small>{{ stamp(c.start).slice(0, 5) }} {{ stamp(c.start).slice(11, 16) }}</small>
            </button>
          }
        </div>
      </fieldset>
    }
    <fieldset>
      <legend>From the original analysis</legend>
      <div class="chips">
        @for (p of presets(); track p.start) {
          <button type="button" class="chip" [class.on]="p.start === sel.start()" [disabled]="!p.ok"
                  [title]="p.ok ? p.from.join(', ') : 'outside the selected record'" (click)="sel.use(p.start, keepLength() ? undefined : 30)">
            <small>{{ stamp(p.start).slice(0, 16) }}</small>
          </button>
        }
      </div>
    </fieldset>
  `,
  styles: `
    .field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.9rem; margin-bottom: 0.7rem; }
    .field input { font: inherit; padding: 0.3rem 0.4rem; border: 1px solid var(--rule); border-radius: var(--radius);
                   background: var(--panel); color: var(--ink); }
    .chip { font-size: 0.82rem; font-variant-numeric: tabular-nums; }
    .chip b { font-weight: 600; }
    .chip small { font-size: 0.78rem; color: inherit; opacity: 0.8; }
  `,
})
export class WindowPicker {
  readonly sel = inject(Selection);
  private ds = inject(Datasets);
  private route = inject(ActivatedRoute);

  showLength = input(true);
  keepLength = input(false);

  readonly stamp = stamp;
  readonly fix = fix;
  readonly value = eventValue;

  presets = computed(() => {
    const d = this.ds.selected();
    return WINDOWS_30.map(p => ({ ...p, ok: !!d && inRecord(p, d.start, d.end) }));
  });

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    const start = q.get('start');
    const minutes = Number(q.get('minutes'));
    if (start) this.sel.use(start, minutes > 0 ? minutes : undefined);
  }

  setStart(e: Event): void {
    const v = eventText(e);
    if (v) this.sel.start.set(localInput(v.length === 16 ? `${v}:00` : v));
  }
}
