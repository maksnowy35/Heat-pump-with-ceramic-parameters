import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { Api } from '../../core/api';
import { Datasets } from '../../core/datasets';
import { Mode } from '../../core/mode';
import { errorMessage, fix } from '../../core/format';
import { CumulativeResponse } from '../../core/models';
import {
  COP_COLOR, COP_TOTAL_COLOR, DISCHARGE_COLOR, FROST, SIGNAL, STEEL, SUCTION_COLOR, withAlpha,
} from '../../core/palette';
import { Band, ChartView, Series } from '../../shared/chart';
import { DatasetBar } from '../../shared/dataset-bar';
import { ToolHead } from '../../shared/tool-head';

type Result = { state: 'loading' } | { state: 'ok'; data: CumulativeResponse } | { state: 'error'; message: string };

@Component({
  selector: 'app-overview',
  imports: [ChartView, DatasetBar, ToolHead],
  template: `
    <app-tool-head id="overview" />
    <app-dataset-bar />
    @if (error(); as e) { <p class="error">{{ e }}</p> }
    @if (data(); as c) {
      <header class="readout">
        <p class="big">COP {{ fix(c.final_cop_total) }} <small>over the whole record{{ calc.mode() === 'scripts' ? ', as the scripts sum it' : '' }}</small></p>
        <p>{{ fix(c.final_cop) }} for the compressor alone · {{ c.off.length }} long compressor stop{{ c.off.length === 1 ? '' : 's' }} · {{ c.gaps.length }} logging gap{{ c.gaps.length === 1 ? '' : 's' }}</p>
      </header>
      <div class="figure">
        <h3>Running COP</h3>
        <app-chart [series]="cop()" [bands]="bands()" xLabel="Operating time [h]" [xMin]="0" [xMax]="xMax()" yLabel="COP [-]"
                   [yMin]="0" [height]="320" ariaLabel="Running COP over the record" />
      </div>
      <div class="grid2" style="margin-top: 1.4rem">
        <div class="figure">
          <h3>Outdoor air, T3</h3>
          <app-chart [series]="t3()" [bands]="bands()" xLabel="Operating time [h]" [xMin]="0" [xMax]="xMax()" yLabel="T3 [°C]"
                     [legend]="false" [height]="250" ariaLabel="Outdoor temperature" />
        </div>
        <div class="figure">
          <h3>Suction and discharge pressure</h3>
          <app-chart [series]="pressures()" [bands]="bands()" xLabel="Operating time [h]" [xMin]="0" [xMax]="xMax()"
                     yLabel="p [bar(g)]" [height]="250" ariaLabel="Refrigerant pressures" />
        </div>
      </div>
      <p class="note">
        Where the compressor stops, the suction and discharge pressures meet at the saturation pressure of the room temperature;
        the COP is not computed there. Times are hours from {{ c.origin.replace('T', ' ') }}.
      </p>
    }
  `,
})
export class OverviewPage {
  private api = inject(Api);
  readonly ds = inject(Datasets);
  readonly calc = inject(Mode);
  readonly fix = fix;

  private key = computed(() => `${this.ds.selectedId()}|${this.ds.selected()?.missing_flags ?? ''}|${this.calc.mode()}`);

  result = toSignal(
    toObservable(this.key).pipe(
      switchMap(() =>
        this.api.cumulative(this.ds.selectedId(), this.calc.cop()).pipe(
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
  xMax = computed(() => {
    const h = this.data()?.hours ?? [];
    return Math.ceil((h[h.length - 1] ?? 0) as number);
  });

  bands = computed<Band[]>(() => {
    const c = this.data();
    if (!c) return [];
    return [
      ...c.off.map(s => ({ from: s.start, to: s.end, color: withAlpha(STEEL, 0.13), label: 'compressor off' })),
      ...c.gaps.map(s => ({ from: s.start, to: s.end, color: withAlpha(SIGNAL, 0.1), label: 'no data' })),
    ];
  });

  cop = computed<Series[]>(() => {
    const c = this.data();
    if (!c) return [];
    const x = c.hours as number[];
    return [
      { label: 'COP, compressor alone', x, y: c.cop, color: COP_COLOR },
      { label: 'COP with the constant power', x, y: c.cop_total, color: COP_TOTAL_COLOR },
    ];
  });

  t3 = computed<Series[]>(() => {
    const c = this.data();
    return c ? [{ label: 'T3', x: c.hours as number[], y: c.t3, color: FROST }] : [];
  });

  pressures = computed<Series[]>(() => {
    const c = this.data();
    if (!c) return [];
    const x = c.hours as number[];
    return [
      { label: 'Suction', x, y: c.p_suction, color: SUCTION_COLOR },
      { label: 'Discharge', x, y: c.p_discharge, color: DISCHARGE_COLOR },
    ];
  });
}
