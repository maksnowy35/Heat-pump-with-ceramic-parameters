import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';

import { Api } from '../../core/api';
import { Datasets } from '../../core/datasets';
import { errorMessage, fix, num, stamp } from '../../core/format';
import { BlocksResponse, DEFAULT_COP } from '../../core/models';
import { COP_COLOR, COP_TOTAL_COLOR, POWER_COLOR } from '../../core/palette';
import { Selection } from '../../core/selection';
import { ChartView, Series, steps } from '../../shared/chart';
import { DatasetBar } from '../../shared/dataset-bar';
import { ToolHead } from '../../shared/tool-head';
import { WindowPicker } from '../../shared/window-picker';

type Result<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; message: string };

@Component({
  selector: 'app-cop',
  imports: [ChartView, DatasetBar, ToolHead, WindowPicker],
  templateUrl: './cop.html',
})
export class CopPage {
  private api = inject(Api);
  readonly ds = inject(Datasets);
  readonly sel = inject(Selection);

  readonly num = num;
  readonly fix = fix;
  readonly stamp = stamp;

  private request = computed(() => ({ id: this.ds.selectedId(), start: this.sel.start(), minutes: this.sel.minutes() }));

  result = toSignal(
    toObservable(this.request).pipe(
      debounceTime(150),
      switchMap(r =>
        this.api.blocks(r.id, r.start, r.minutes, DEFAULT_COP).pipe(
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
}
