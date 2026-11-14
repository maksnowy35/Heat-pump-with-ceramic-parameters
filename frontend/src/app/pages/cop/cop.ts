import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, debounceTime, filter, map, of, startWith, switchMap } from 'rxjs';

import { Api } from '../../core/api';
import { Datasets } from '../../core/datasets';
import { errorMessage, eventText, eventValue, fix, localInput, num, stamp } from '../../core/format';
import { BlocksResponse, CumulativeResponse, DEFAULT_COP } from '../../core/models';
import {
  COP_COLOR, COP_TOTAL_COLOR, DISCHARGE_COLOR, POWER_COLOR, SIGNAL, STEEL, SUCTION_COLOR, withAlpha,
} from '../../core/palette';
import { WINDOWS_30, inRecord } from '../../core/windows';
import { Band, ChartView, Series, steps } from '../../shared/chart';
import { DatasetBar } from '../../shared/dataset-bar';

type Result<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; message: string };

@Component({
  selector: 'app-cop',
  imports: [ChartView, DatasetBar],
  templateUrl: './cop.html',
  styleUrl: './cop.scss',
})
export class CopPage {
  private api = inject(Api);
  readonly ds = inject(Datasets);

  readonly num = num;
  readonly fix = fix;
  readonly stamp = stamp;
  readonly value = eventValue;
  readonly text = eventText;

  start = signal('2025-02-22T08:24:58');
  minutes = signal(30);
  presets = computed(() => {
    const d = this.ds.selected();
    return WINDOWS_30.map(p => ({ ...p, ok: !!d && inRecord(p, d.start, d.end) }));
  });

  private request = computed(() => ({ id: this.ds.selectedId(), start: this.start(), minutes: this.minutes() }));

  result = toSignal(
    toObservable(this.request).pipe(
      debounceTime(150),
      filter(r => !!r.start),
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
      ...steps('COP without the constant power', COP_COLOR, x, 2, b.map(k => k.cop_plot), b.map(k => k.valid)),
      ...steps('COP of the unit', COP_TOTAL_COLOR, x, 2, b.map(k => k.cop_total_plot), b.map(k => k.valid_total)),
      ...steps('Compressor power', POWER_COLOR, x, 2, b.map(k => k.p_comp), b.map(() => true), 'y2', 2),
    ];
  });

  // whole record
  cumulative = toSignal(
    combineLatest([toObservable(this.ds.selectedId)]).pipe(
      switchMap(([id]) => this.api.cumulative(id, DEFAULT_COP).pipe(catchError(() => of(null as CumulativeResponse | null)))),
    ),
  );

  bands = computed<Band[]>(() => {
    const c = this.cumulative();
    if (!c) return [];
    return [
      ...c.off.map(s => ({ from: s.start, to: s.end, color: withAlpha(STEEL, 0.12), label: 'compressor off' })),
      ...c.gaps.map(s => ({ from: s.start, to: s.end, color: withAlpha(SIGNAL, 0.1), label: 'no data' })),
    ];
  });

  cumCop = computed<Series[]>(() => {
    const c = this.cumulative();
    if (!c) return [];
    const x = c.hours as number[];
    return [
      { label: 'COP without the constant power', x, y: c.cop, color: COP_COLOR },
      { label: 'COP with the constant power', x, y: c.cop_total, color: COP_TOTAL_COLOR },
    ];
  });

  cumT3 = computed<Series[]>(() => {
    const c = this.cumulative();
    return c ? [{ label: 'T3', x: c.hours as number[], y: c.t3, color: COP_COLOR }] : [];
  });

  cumP = computed<Series[]>(() => {
    const c = this.cumulative();
    if (!c) return [];
    const x = c.hours as number[];
    return [
      { label: 'Suction', x, y: c.p_suction, color: SUCTION_COLOR },
      { label: 'Discharge', x, y: c.p_discharge, color: DISCHARGE_COLOR },
    ];
  });

  usePreset(start: string): void {
    this.start.set(start);
    this.minutes.set(30);
  }

  setStart(e: Event): void {
    const v = eventText(e);
    if (v) this.start.set(localInput(v.length === 16 ? `${v}:00` : v));
  }
}
