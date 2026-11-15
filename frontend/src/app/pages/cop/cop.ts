import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';

import { Api } from '../../core/api';
import { Datasets } from '../../core/datasets';
import { Mode } from '../../core/mode';
import { errorMessage, fix, num, stamp } from '../../core/format';
import { BlocksResponse, CopTPoint } from '../../core/models';
import { COP_COLOR, COP_TOTAL_COLOR, POWER_COLOR, STEEL } from '../../core/palette';
import { Selection } from '../../core/selection';
import { ChartView, Series, steps } from '../../shared/chart';
import { DatasetBar } from '../../shared/dataset-bar';
import { ToolHead } from '../../shared/tool-head';
import { WindowPicker } from '../../shared/window-picker';
import { RouterLink } from '@angular/router';

/** COP ranges given for the measured windows in section 4.3 of the thesis: [T3, low, high] */
const THESIS_RANGES: [number, number, number][] = [
  [3.5, 3.9, 4.1], [5, 3.4, 3.6], [6.5, 3.8, 4.0], [6.5, 3.3, 4.0], [10, 3.0, 3.4], [11, 2.5, 2.8], [12, 2.5, 3.0], [14, 2.9, 3.1],
];

type Result<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; message: string };

@Component({
  selector: 'app-cop',
  imports: [ChartView, DatasetBar, ToolHead, WindowPicker, RouterLink],
  templateUrl: './cop.html',
})
export class CopPage {
  private api = inject(Api);
  readonly ds = inject(Datasets);
  readonly calc = inject(Mode);
  readonly sel = inject(Selection);

  readonly num = num;
  readonly fix = fix;
  readonly stamp = stamp;

  private request = computed(() => ({ id: this.ds.selectedId(), start: this.sel.start(), minutes: this.sel.minutes(), cop: this.calc.cop() }));

  result = toSignal(
    toObservable(this.request).pipe(
      debounceTime(150),
      switchMap(r =>
        this.api.blocks(r.id, r.start, r.minutes, r.cop).pipe(
          map(data => ({ state: 'ok', data }) as Result<BlocksResponse>),
          catchError(err => of({ state: 'error', message: errorMessage(err) } as Result<BlocksResponse>)),
          startWith({ state: 'loading' } as Result<BlocksResponse>),
        ),
      ),
    ),
    { initialValue: { state: 'loading' } as Result<BlocksResponse> },
  );

  data = computed(() => {
    const r = this.result();
    return r.state === 'ok' ? r.data : null;
  });
  error = computed(() => {
    const r = this.result();
    return r.state === 'error' ? r.message : null;
  });

  copSeries = computed<Series[]>(() => {
    const d = this.data();
    if (!d) return [];
    const b = d.blocks;
    const x = b.map(k => k.minutes);
    return [
      ...steps('COP, compressor alone', COP_COLOR, x, 2, b.map(k => k.cop_plot), b.map(k => k.valid)),
      ...steps('COP with fan and automation', COP_TOTAL_COLOR, x, 2, b.map(k => k.cop_total_plot), b.map(k => k.valid_total)),
      ...steps('Compressor power', POWER_COLOR, x, 2, b.map(k => k.p_comp), b.map(() => true), 'y2', 2),
    ];
  });

  // COP against outdoor temperature, one point per steady window
  private recordKey = computed(() => `${this.ds.selectedId()}|${this.ds.selected()?.missing_flags ?? ''}|${this.calc.mode()}`);
  copT = toSignal(
    toObservable(this.recordKey).pipe(
      switchMap(() => this.api.copVsTout(this.ds.selectedId(), this.calc.cop()).pipe(catchError(() => of([] as CopTPoint[])))),
    ),
    { initialValue: [] as CopTPoint[] },
  );

  copTSeries = computed<Series[]>(() => {
    const pts = this.copT().filter(p => p.t_out !== null);
    const thesis: Series = { label: 'Thesis §4.3, measured windows', color: STEEL, x: [], y: [], width: 6 };
    for (const [t, lo, hi] of THESIS_RANGES) {
      thesis.x.push(t, t, t);
      thesis.y.push(lo, hi, null);
    }
    return [
      thesis,
      { label: 'COP with fan and automation', color: COP_TOTAL_COLOR, x: pts.map(p => p.t_out!), y: pts.map(p => p.cop_total), points: 5, line: false },
      { label: 'COP, compressor alone', color: COP_COLOR, x: pts.map(p => p.t_out!), y: pts.map(p => p.cop), points: 4, line: false },
    ];
  });
}
