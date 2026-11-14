import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { CHANNELS } from '../../core/channels';
import { Datasets } from '../../core/datasets';
import { errorMessage, eventText, eventValue, fix, localInput, pct, stamp } from '../../core/format';
import { Coverage, PhasePlan, PhasePreview, PhaseSuggestion } from '../../core/models';
import { INK, OCHRE, SIGNAL, channelColor } from '../../core/palette';
import { Selection } from '../../core/selection';
import { WINDOWS_30 } from '../../core/windows';
import { ChartView, Series } from '../../shared/chart';
import { DatasetBar } from '../../shared/dataset-bar';
import { ToolHead } from '../../shared/tool-head';

@Component({
  selector: 'app-record',
  imports: [ChartView, DatasetBar, ToolHead, RouterLink],
  templateUrl: './record.html',
  styleUrl: './record.scss',
})
export class RecordPage {
  private api = inject(Api);
  readonly ds = inject(Datasets);
  readonly sel = inject(Selection);

  readonly channels = CHANNELS;
  readonly stamp = stamp;
  readonly fix = fix;
  readonly pct = pct;
  readonly text = eventText;
  readonly value = eventValue;

  // supply/exhaust flags
  phase = signal<PhaseSuggestion | null>(null);
  plan = signal<PhasePlan | null>(null);
  preview = signal<PhasePreview | null>(null);
  busy = signal(false);
  message = signal<string | null>(null);

  // windows
  tolerance = signal(2);
  coverage = signal<Coverage[]>([]);

  constructor() {
    effect(() => {
      const d = this.ds.selected();
      if (!d) return;
      untracked(() => this.loadPhases(d.id));
    });
    effect(() => {
      const d = this.ds.selected();
      const tol = this.tolerance();
      if (!d) return;
      untracked(() =>
        this.api
          .checkWindows(d.id, WINDOWS_30.map(w => ({ start: w.start, minutes: w.minutes })), tol)
          .pipe(catchError(() => of([] as Coverage[])))
          .subscribe(c => this.coverage.set(c)),
      );
    });
    effect(() => {
      const p = this.plan();
      const id = this.ds.selectedId();
      if (!p) {
        this.preview.set(null);
        return;
      }
      untracked(() =>
        this.api.phasePreview(id, p).pipe(catchError(() => of(null))).subscribe(r => this.preview.set(r)),
      );
    });
  }

  private loadPhases(id: string): void {
    this.api.phases(id).pipe(catchError(() => of(null))).subscribe(s => {
      this.phase.set(s);
      this.plan.set(s?.plan ? { ...s.plan, anchor: s.plan.anchor.slice(0, 19) } : null);
    });
  }

  completeness = computed(() => this.ds.selected()?.completeness ?? {});

  presetRows = computed(() =>
    WINDOWS_30.map((w, i) => ({ preset: w, cov: this.coverage()[i] ?? null })),
  );

  previewSeries = computed<Series[]>(() => {
    const p = this.preview();
    if (!p) return [];
    const x = p.seconds as number[];
    return [
      { label: 'T2', x, y: p.t2, color: channelColor(2) },
      { label: 'Supply flag, logged', x, y: p.supply_logged, color: INK, axis: 'y2', width: 2.5 },
      { label: 'Supply flag, rebuilt', x, y: p.supply_rebuilt, color: SIGNAL, axis: 'y2', dash: [4, 3], width: 1.5 },
    ];
  });
  readonly ochre = OCHRE;

  setAnchor(e: Event): void {
    const v = eventText(e);
    this.plan.update(p => (p && v ? { ...p, anchor: localInput(v.length === 16 ? `${v}:00` : v) } : p));
  }

  setHalf(e: Event): void {
    const v = eventValue(e);
    if (v > 1) this.plan.update(p => (p ? { ...p, half_s: v } : p));
  }

  setState(supply: boolean): void {
    this.plan.update(p => (p ? { ...p, supply } : p));
  }

  apply(): void {
    const p = this.plan();
    if (!p) return;
    this.busy.set(true);
    this.api.phaseApply(this.ds.selectedId(), p).subscribe({
      next: info => {
        this.ds.update(info);
        this.busy.set(false);
        this.message.set(`Flags written for ${this.preview()?.filled.toLocaleString('en-US') ?? ''} rows.`);
      },
      error: err => {
        this.busy.set(false);
        this.message.set(errorMessage(err));
      },
    });
  }

  resetDemo(): void {
    this.api.reset('demo').subscribe(info => {
      this.ds.update(info);
      this.message.set(null);
    });
  }
}
