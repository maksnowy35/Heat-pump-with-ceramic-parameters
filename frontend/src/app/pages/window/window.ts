import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';

import { Api } from '../../core/api';
import { Datasets } from '../../core/datasets';
import { errorMessage, fix } from '../../core/format';
import { DEFAULT_COP, WindowResponse } from '../../core/models';
import {
  COP_COLOR, COP_TOTAL_COLOR, DISCHARGE_COLOR, OCHRE, POWER_COLOR, STEEL, SUCTION_COLOR,
} from '../../core/palette';
import { mean, points, xAxis } from '../../core/plots';
import { Selection } from '../../core/selection';
import { ChartView, Series } from '../../shared/chart';
import { DatasetBar } from '../../shared/dataset-bar';
import { ToolHead } from '../../shared/tool-head';
import { WindowPicker } from '../../shared/window-picker';

type Result = { state: 'loading' } | { state: 'ok'; data: WindowResponse } | { state: 'error'; message: string };

const T = ['t1', 't2', 't3', 't4', 't5'];
const RH = ['rh_1', 'rh_2', 'rh_3', 'rh_4', 'rh_5'];
const I = ['i_1', 'i_2', 'i_3', 'i_4', 'i_5'];

@Component({
  selector: 'app-window',
  imports: [ChartView, DatasetBar, ToolHead, WindowPicker],
  templateUrl: './window.html',
})
export class WindowPage {
  private api = inject(Api);
  readonly ds = inject(Datasets);
  readonly sel = inject(Selection);
  readonly fix = fix;

  private request = computed(() => ({ id: this.ds.selectedId(), start: this.sel.start(), minutes: this.sel.minutes() }));

  result = toSignal(
    toObservable(this.request).pipe(
      debounceTime(150),
      switchMap(r =>
        this.api.window(r.id, r.start, r.minutes, DEFAULT_COP).pipe(
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

  private x = computed(() => (this.data() ? xAxis(this.data()!, 60) : []));
  step = computed(() => (this.sel.minutes() <= 40 ? 3 : 10));

  temps = computed(() => (this.data() ? points(this.data()!, this.x(), T, k => `T${k}`) : []));
  humid = computed(() => (this.data() ? points(this.data()!, this.x(), RH, k => `RH${k}`) : []));
  enth = computed(() => (this.data() ? points(this.data()!, this.x(), I, k => `i${k}`) : []));

  pressures = computed<Series[]>(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { label: 'Suction', x: this.x(), y: d.series['p_ssania'], color: SUCTION_COLOR, points: 1.5, width: 1 },
      { label: 'Discharge', x: this.x(), y: d.series['p_tloczenia'], color: DISCHARGE_COLOR, points: 1.5, width: 1 },
    ];
  });

  cop = computed<Series[]>(() => {
    const d = this.data();
    if (!d) return [];
    const x = this.x();
    return [
      { label: 'COP, compressor alone', x, y: d.series['cop_running'], color: COP_COLOR },
      { label: 'COP with fan and automation', x, y: d.series['cop_total_running'], color: COP_TOTAL_COLOR },
      { label: 'Compressor power', x, y: d.series['Moc_Czynna'], color: POWER_COLOR, axis: 'y2', width: 1 },
    ];
  });

  refrigerant = computed<Series[]>(() => {
    const d = this.data();
    if (!d) return [];
    const x = this.x();
    return [
      { label: 't_cond (controller)', x, y: d.series['t_skraplania'], color: DISCHARGE_COLOR },
      { label: 'T_sat(p_dis)', x, y: d.series['t_sat_discharge'], color: DISCHARGE_COLOR, dash: [5, 4], legend: false },
      { label: 't_evap (controller)', x, y: d.series['t_parowania'], color: SUCTION_COLOR },
      { label: 'T_sat(p_suc)', x, y: d.series['t_sat_suction'], color: SUCTION_COLOR, dash: [5, 4], legend: false },
      { label: 'Superheat', x, y: d.series['superheat'], color: OCHRE, axis: 'y2', width: 1.4 },
    ];
  });

  t3 = computed(() => mean(this.data()?.series['t3'] ?? []));
  superheat = computed(() => mean(this.data()?.series['superheat'] ?? []));
  pdis = computed(() => mean(this.data()?.series['p_tloczenia'] ?? []));
  psuc = computed(() => mean(this.data()?.series['p_ssania'] ?? []));
  readonly steel = STEEL;
}
