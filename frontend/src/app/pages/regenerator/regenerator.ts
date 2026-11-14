import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';

import { Api } from '../../core/api';
import { errorMessage, eventValue, fix, num, pct } from '../../core/format';
import { RegeneratorRequest, RegeneratorResponse } from '../../core/models';
import { FROST, OCHRE, SIGNAL } from '../../core/palette';
import { ChartView, Series } from '../../shared/chart';
import { ToolHead } from '../../shared/tool-head';
import { CeramicBlock } from './ceramic-block';

type Result = { state: 'loading' } | { state: 'ok'; data: RegeneratorResponse } | { state: 'error'; message: string };

interface Line {
  key: string;
  label: string;
  unit: string;
  scale?: number;
  thesis?: string;
  digits?: number;
}

const LINES: { group: string; lines: Line[] }[] = [
  {
    group: 'Channels',
    lines: [
      { key: 'pitch', label: 'pitch p', unit: 'mm', scale: 1e3, thesis: 'pitch_mm', digits: 4 },
      { key: 'wall', label: 'wall t', unit: 'mm', scale: 1e3, thesis: 'wall_mm' },
      { key: 'channel', label: 'channel a = D_h', unit: 'mm', scale: 1e3, thesis: 'channel_mm', digits: 4 },
      { key: 'open_area_block', label: 'open area, block', unit: 'm²', thesis: 'open_area_block', digits: 5 },
      { key: 'open_area_row', label: 'open area, row of 15', unit: 'm²', thesis: 'open_area_row', digits: 5 },
    ],
  },
  {
    group: 'Flow and heat transfer',
    lines: [
      { key: 'volume_flow', label: 'volume flow V̇', unit: 'm³/s', thesis: 'volume_flow' },
      { key: 'velocity', label: 'velocity in the channels v', unit: 'm/s', thesis: 'velocity', digits: 4 },
      { key: 'reynolds', label: 'Reynolds number Re', unit: '–', thesis: 'reynolds', digits: 4 },
      { key: 'h', label: 'heat transfer coefficient h', unit: 'W/(m²K)', thesis: 'h' },
      { key: 'hA', label: 'h·A, both rows', unit: 'W/K', thesis: 'hA', digits: 4 },
      { key: 'ntu', label: 'NTU = hA / (ṁ c_p)', unit: '–', thesis: 'ntu' },
    ],
  },
  {
    group: 'Pressure drop and fan',
    lines: [
      { key: 'dp', label: 'pressure drop Δp', unit: 'Pa', thesis: 'dp' },
      { key: 'fan_power_mech', label: 'fan power V̇·Δp', unit: 'W', thesis: 'fan_power_mech' },
      { key: 'fan_power_el', label: 'electrical, at the fan efficiency', unit: 'W', thesis: 'fan_power_el' },
      { key: 'fan_saving_mech', label: 'saving against Δp = 98 Pa', unit: 'W', thesis: 'fan_saving_mech' },
      { key: 'fan_saving_el', label: 'saving, electrical', unit: 'W', thesis: 'fan_saving_el' },
    ],
  },
  {
    group: 'Heat storage',
    lines: [
      { key: 'heat_capacity', label: 'heat capacity C', unit: 'kJ/K', scale: 1e-3, thesis: 'heat_capacity', digits: 4 },
      { key: 'tau', label: 'time constant τ = C / hA', unit: 's', thesis: 'tau' },
      { key: 'half_cycle_over_tau', label: 'half-cycle / τ', unit: '–' },
      { key: 'tau_bed', label: 'air capacity time C / (ṁ c_p)', unit: 's' },
      { key: 'utilization', label: 'utilisation ṁ c_p t_half / C', unit: '–' },
    ],
  },
];

@Component({
  selector: 'app-regenerator',
  imports: [ChartView, ToolHead, CeramicBlock],
  templateUrl: './regenerator.html',
  styleUrl: './regenerator.scss',
})
export class RegeneratorPage {
  private api = inject(Api);
  readonly groups = LINES;
  readonly fix = fix;
  readonly num = num;
  readonly pct = pct;
  readonly value = eventValue;

  massFlow = signal(0.468);
  cells = signal(60);
  ratio = signal(8);
  lengthTop = signal(300);
  lengthBottom = signal(74);
  halfCycle = signal(60);
  capacity = signal<'thesis' | 'masses'>('thesis');

  private request = computed<RegeneratorRequest>(() => ({
    mass_flow: this.massFlow(),
    cells: this.cells(),
    channel_to_wall: this.ratio(),
    length_top: this.lengthTop() / 1000,
    length_bottom: this.lengthBottom() / 1000,
    heat_capacity: this.capacity() === 'thesis' ? 95000 : null,
    half_cycle: this.halfCycle(),
    fan_efficiency: 0.5,
  }));

  result = toSignal(
    toObservable(this.request).pipe(
      debounceTime(80),
      switchMap(r =>
        this.api.regenerator(r).pipe(
          map(data => ({ state: 'ok', data }) as Result),
          catchError(err => of({ state: 'error', message: errorMessage(err) } as Result)),
          startWith({ state: 'loading' } as Result),
        ),
      ),
    ),
    { initialValue: { state: 'loading' } as Result },
  );
  private last: RegeneratorResponse | null = null;
  data = computed(() => {
    const r = this.result();
    if (r.state === 'ok') this.last = r.data;
    return r.state === 'ok' ? r.data : this.last;
  });
  error = computed(() => {
    const r = this.result();
    return r.state === 'error' ? r.message : null;
  });

  isDefault = computed(() =>
    this.massFlow() === 0.468 && this.cells() === 60 && this.ratio() === 8 && this.lengthTop() === 300 &&
    this.lengthBottom() === 74 && this.capacity() === 'thesis',
  );

  curves = computed<Series[]>(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { label: 'solid to air, 1 − exp(−t/τ)', x: d.curve_t, y: d.captured_tau, color: FROST },
      { label: 'air capacity, 1 − exp(−t·ṁc_p/C)', x: d.curve_t, y: d.captured_bed, color: OCHRE, dash: [6, 4] },
    ];
  });
  markers = computed(() => [{ x: this.halfCycle(), label: `half-cycle ${this.halfCycle()} s`, color: SIGNAL }]);

  show(d: RegeneratorResponse, l: Line): string {
    const v = d.values[l.key];
    return v === undefined ? '–' : num(v * (l.scale ?? 1), l.digits ?? 3);
  }

  thesis(d: RegeneratorResponse, l: Line): string {
    if (!l.thesis || !this.isDefault()) return '';
    const v = d.thesis[l.thesis];
    return v === undefined ? '' : num(v * (l.key === 'heat_capacity' ? 1e-3 : 1), l.digits ?? 3);
  }

  reset(): void {
    this.massFlow.set(0.468);
    this.cells.set(60);
    this.ratio.set(8);
    this.lengthTop.set(300);
    this.lengthBottom.set(74);
    this.halfCycle.set(60);
    this.capacity.set('thesis');
  }
}
