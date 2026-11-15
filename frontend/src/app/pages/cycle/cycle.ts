import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';

import { Api } from '../../core/api';
import { Datasets } from '../../core/datasets';
import { Mode } from '../../core/mode';
import { addMinutes, errorMessage, fix, stamp } from '../../core/format';
import { WindowResponse } from '../../core/models';
import { DISCHARGE_COLOR, LEAF, POWER_COLOR, SUCTION_COLOR } from '../../core/palette';
import { points, supplyBands, xAxis } from '../../core/plots';
import { Selection } from '../../core/selection';
import { ChartView, Series } from '../../shared/chart';
import { DatasetBar } from '../../shared/dataset-bar';
import { ToolHead } from '../../shared/tool-head';
import { WindowPicker } from '../../shared/window-picker';

type Result = { state: 'loading' } | { state: 'ok'; data: WindowResponse } | { state: 'error'; message: string };

@Component({
  selector: 'app-cycle',
  imports: [ChartView, DatasetBar, ToolHead, WindowPicker],
  templateUrl: './cycle.html',
})
export class CyclePage {
  private api = inject(Api);
  readonly ds = inject(Datasets);
  readonly calc = inject(Mode);
  readonly sel = inject(Selection);
  readonly fix = fix;
  readonly stamp = stamp;

  align = signal(true);
  /** cycles moved forward/back from the selected window start */
  offset = signal(0);
  private start = computed(() => addMinutes(this.sel.start(), this.offset() * 2));

  private request = computed(() => ({ id: this.ds.selectedId(), start: this.start(), align: this.align(), cop: this.calc.cop() }));

  result = toSignal(
    toObservable(this.request).pipe(
      debounceTime(100),
      switchMap(r =>
        this.api.window(r.id, r.start, 2, r.cop, r.align).pipe(
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

  private x = computed(() => (this.data() ? xAxis(this.data()!, 1) : []));
  bands = computed(() => (this.data() ? supplyBands(this.data()!, this.x()) : []));

  temps = computed(() => (this.data() ? points(this.data()!, this.x(), ['t1', 't2', 't3', 't4', 't5'], k => `T${k}`) : []));
  humid = computed(() => (this.data() ? points(this.data()!, this.x(), ['rh_1', 'rh_2', 'rh_3', 'rh_4', 'rh_5'], k => `RH${k}`) : []));
  enth = computed(() => (this.data() ? points(this.data()!, this.x(), ['i_1', 'i_2', 'i_3', 'i_4', 'i_5'], k => `i${k}`) : []));
  pressures = computed<Series[]>(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { label: 'Suction', x: this.x(), y: d.series['p_ssania'], color: SUCTION_COLOR, points: 2, width: 1 },
      { label: 'Discharge', x: this.x(), y: d.series['p_tloczenia'], color: DISCHARGE_COLOR, points: 2, width: 1 },
    ];
  });
  power = computed<Series[]>(() => {
    const d = this.data();
    if (!d) return [];
    const x = this.x();
    return [
      { label: 'Heating capacity', x, y: d.series['q_kw'].map(v => (v === null ? null : v * 1000)), color: LEAF, width: 2 },
      { label: 'Electrical power, unit', x, y: d.series['p_total'], color: POWER_COLOR, dash: [5, 4] },
      { label: 'Compressor power', x, y: d.series['Moc_Czynna'], color: POWER_COLOR },
    ];
  });

  constructor() {
    effect(() => {
      this.sel.start();
      untracked(() => this.offset.set(0));
    });
  }

  setAlign(on: boolean): void {
    this.align.set(on);
  }

  move(n: number): void {
    this.offset.update(o => o + n);
  }
}
