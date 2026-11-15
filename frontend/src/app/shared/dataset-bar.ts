import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Datasets } from '../core/datasets';
import { eventText, pct, stamp } from '../core/format';
import { Mode } from '../core/mode';

@Component({
  selector: 'app-dataset-bar',
  imports: [RouterLink],
  template: `
    <section class="ds" aria-label="Record">
      <label class="pick">
        <span>Record</span>
        <select [value]="state.selectedId()" (change)="state.selectedId.set(text($event))">
          @for (d of state.list(); track d.id) {
            <option [value]="d.id" [selected]="d.id === state.selectedId()">{{ d.name }}</option>
          }
        </select>
      </label>
      <label class="upload">
        <input type="file" multiple accept=".xlsx,.xls,.csv" (change)="pick($event)" [disabled]="state.uploading()">
        <span>{{ state.uploading() ? 'Reading…' : 'Load reports (.xlsx / .csv)' }}</span>
      </label>
      <div class="mode">
        <span>Calculation</span>
        <div class="segmented" role="group" aria-label="Calculation mode">
          <button type="button" [class.on]="calc.mode() === 'scripts'" (click)="calc.mode.set('scripts')"
                  title="flow 0.389, constant power as each script added it, clock-aligned 2-min blocks">as in the scripts</button>
          <button type="button" [class.on]="calc.mode() === 'corrected'" (click)="calc.mode.set('corrected')"
                  title="mass flow 0.468 kg/s, constant power over the whole cycle, time step capped after gaps, blocks per cycle">corrected</button>
        </div>
        <a routerLink="/model" fragment="audit">what differs?</a>
      </div>
      @if (state.selected(); as d) {
        <p class="facts">
          @if (d.source === 'demo') { <b class="badge">synthetic</b> }
          {{ stamp(d.start) }} – {{ stamp(d.end) }} · {{ d.rows.toLocaleString('en-US') }} rows every {{ d.sampling_s }} s
          · compressor on {{ pct(d.compressor_on) }}
          @if (d.gaps.length) { · {{ d.gaps.length }} logging gap{{ d.gaps.length > 1 ? 's' : '' }} }
          @if (d.missing_flags) { · <span class="warn">{{ d.missing_flags.toLocaleString('en-US') }} rows without supply/exhaust flags</span> }
        </p>
      }
      @if (state.error(); as e) { <p class="error">{{ e }}</p> }
    </section>
  `,
  styles: `
    .ds { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1.2rem; padding: 0.7rem 0.9rem;
          background: var(--panel); border: 1px solid var(--rule); border-radius: var(--radius); margin-bottom: 1.6rem; }
    .pick { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
    .pick span { font-family: var(--font-display); font-weight: 600; }
    .upload { position: relative; font-size: 0.9rem; }
    .upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .upload span { display: inline-block; padding: 0.3rem 0.7rem; border: 1px dashed var(--steel); border-radius: var(--radius); }
    .upload:hover span { border-color: var(--ink); }
    .upload:focus-within span { outline: 2px solid var(--frost); outline-offset: 2px; }
    .mode { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; font-size: 0.9rem; }
    .mode > span { font-family: var(--font-display); font-weight: 600; }
    .mode .segmented { margin: 0; }
    .mode .segmented button { font-size: 0.85rem; padding: 0.25rem 0.6rem; }
    .mode a { font-size: 0.8rem; }
    .facts { margin: 0; font-size: 0.85rem; color: var(--steel); flex-basis: 100%; }
    .badge { font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--paper);
             background: var(--ochre); padding: 0.05rem 0.4rem; border-radius: 3px; margin-right: 0.3rem; }
    .warn { color: var(--signal); }
    .error { flex-basis: 100%; margin: 0; }
  `,
})
export class DatasetBar {
  readonly state = inject(Datasets);
  readonly calc = inject(Mode);
  readonly stamp = stamp;
  readonly pct = pct;
  readonly text = eventText;

  pick(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.state.upload(Array.from(input.files ?? []));
    input.value = '';
  }
}
