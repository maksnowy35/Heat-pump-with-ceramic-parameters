import { Component, computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { inject } from '@angular/core';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';

import { Api } from '../../core/api';
import { errorMessage, eventText, eventValue, fix, num } from '../../core/format';
import { NtcResponse } from '../../core/models';
import { FROST, INK, LEAF, OCHRE, SIGNAL } from '../../core/palette';
import { KeyValuePipe } from '@angular/common';
import { ChartView, Series } from '../../shared/chart';
import { ToolHead } from '../../shared/tool-head';

type Result = { state: 'loading' } | { state: 'ok'; data: NtcResponse } | { state: 'error'; message: string };

function parseTable(text: string): [number, number][] | null {
  const rows = text
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split(/[;\t ]+/).map(v => Number(v.replace(',', '.'))));
  if (rows.length < 3 || rows.some(r => r.length < 2 || r.some(v => !isFinite(v)))) return null;
  return rows.map(r => [r[0], r[1]] as [number, number]);
}

@Component({
  selector: 'app-ntc',
  imports: [ChartView, ToolHead, KeyValuePipe],
  templateUrl: './ntc.html',
  styleUrl: './ntc.scss',
})
export class NtcPage {
  private api = inject(Api);
  readonly fix = fix;
  readonly num = num;
  readonly value = eventValue;

  mode = signal<'current' | 'resistance'>('current');
  current = signal(2.5);
  supply = signal(9);
  resistance = signal(3600);
  tableText = signal('');
  tableError = signal(false);

  private request = computed(() => {
    const t = this.tableText().trim();
    const table = t ? parseTable(t) : null;
    return {
      table,
      current_ma: this.mode() === 'current' ? this.current() : null,
      resistance: this.mode() === 'resistance' ? this.resistance() : null,
      supply_v: this.supply(),
    };
  });

  result = toSignal(
    toObservable(this.request).pipe(
      debounceTime(150),
      switchMap(r =>
        this.api.ntc(r).pipe(
          map(data => ({ state: 'ok', data }) as Result),
          catchError(err => of({ state: 'error', message: errorMessage(err) } as Result)),
          startWith({ state: 'loading' } as Result),
        ),
      ),
    ),
    { initialValue: { state: 'loading' } as Result },
  );
  data = computed(() => {
    const r = this.result();
    return r.state === 'ok' ? r.data : null;
  });
  error = computed(() => {
    const r = this.result();
    return r.state === 'error' ? r.message : null;
  });

  rt = computed<Series[]>(() => {
    const d = this.data();
    if (!d) return [];
    const out: Series[] = [
      { label: 'Table', x: d.table.map(p => p[0]), y: d.table.map(p => p[1]), color: INK, points: 4, line: false },
      { label: 'Beta fit', x: d.curve_t, y: d.curve_r['beta'], color: OCHRE, dash: [6, 4] },
      { label: 'Steinhart–Hart fit', x: d.curve_t, y: d.curve_r['steinhart_hart'], color: FROST },
    ];
    const r = d.reading;
    if (r && r.t_log !== null) {
      out.push({ label: 'Reading', x: [r.t_log], y: [r.resistance], color: SIGNAL, points: 6, line: false });
    }
    return out;
  });

  interp = computed<Series[]>(() => {
    const d = this.data();
    return d ? [{ label: 'linear in R − logarithmic', x: d.interp_t, y: d.interp_error, color: SIGNAL }] : [];
  });

  bKeys = computed(() => Object.keys(this.data()?.b_values ?? {}));

  readonly classB = [{ y: 0.425, label: 'class B tolerance ±0.425 K', color: LEAF }];

  setTable(e: Event): void {
    const t = eventText(e);
    this.tableError.set(!!t.trim() && parseTable(t) === null);
    if (!t.trim() || parseTable(t)) this.tableText.set(t);
  }

  useDefault(): void {
    this.tableText.set('');
    this.tableError.set(false);
  }
}
