import { Component, ElementRef, OnDestroy, afterRenderEffect, input, untracked, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, Plugin, registerables } from 'chart.js';

import { INK, STEEL, withAlpha } from '../core/palette';

Chart.register(...registerables);
Chart.defaults.font.family = "'Barlow', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = STEEL;

export interface Series {
  label: string;
  x: number[];
  /** null breaks the line (gaps, block boundaries) */
  y: (number | null)[];
  color: string;
  dash?: number[];
  width?: number;
  axis?: 'y' | 'y2';
  /** point radius; 0 (default) draws a plain line */
  points?: number;
  /** false keeps the series out of the legend (e.g. the dotted part of a split series) */
  legend?: boolean;
}

export interface Band {
  from: number;
  to: number;
  color: string;
  label?: string;
}

export interface Marker {
  x?: number;
  y?: number;
  label?: string;
  color?: string;
}

interface Overlay {
  markers: Marker[];
  bands: Band[];
}

/** Shaded x-bands under the data and reference lines over it. */
const overlayPlugin: Plugin = {
  id: 'cpOverlay',
  beforeDatasetsDraw(chart) {
    const o = (chart as unknown as { $overlay?: Overlay }).$overlay;
    if (!o?.bands.length) return;
    const { ctx, chartArea: a, scales } = chart;
    ctx.save();
    for (const b of o.bands) {
      const x0 = Math.max(a.left, scales['x'].getPixelForValue(b.from));
      const x1 = Math.min(a.right, scales['x'].getPixelForValue(b.to));
      if (x1 <= x0) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top);
      if (b.label && x1 - x0 > 40) {
        ctx.fillStyle = INK;
        ctx.font = "500 11px 'Barlow', system-ui, sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(b.label, (x0 + x1) / 2, a.top + 13);
      }
    }
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const o = (chart as unknown as { $overlay?: Overlay }).$overlay;
    if (!o?.markers.length) return;
    const { ctx, chartArea: a, scales } = chart;
    ctx.save();
    ctx.font = "12px 'Barlow', system-ui, sans-serif";
    for (const m of o.markers) {
      ctx.strokeStyle = m.color ?? STEEL;
      ctx.fillStyle = m.color ?? STEEL;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if (m.x !== undefined) {
        const px = scales['x'].getPixelForValue(m.x);
        if (px < a.left || px > a.right) continue;
        ctx.moveTo(px, a.top);
        ctx.lineTo(px, a.bottom);
        ctx.stroke();
        if (m.label) {
          ctx.textAlign = px > (a.left + a.right) / 2 ? 'right' : 'left';
          ctx.fillText(m.label, px + (ctx.textAlign === 'right' ? -6 : 6), a.top + 14);
        }
      } else if (m.y !== undefined) {
        const py = scales['y'].getPixelForValue(m.y);
        if (py < a.top || py > a.bottom) continue;
        ctx.moveTo(a.left, py);
        ctx.lineTo(a.right, py);
        ctx.stroke();
        if (m.label) {
          ctx.textAlign = 'right';
          ctx.fillText(m.label, a.right - 4, py - 5);
        }
      }
    }
    ctx.restore();
  },
};

@Component({
  selector: 'app-chart',
  template: `<div class="wrap" [style.height.px]="height()"><canvas #canvas [attr.aria-label]="ariaLabel()" role="img"></canvas></div>`,
  styles: `.wrap { position: relative; width: 100%; }`,
})
export class ChartView implements OnDestroy {
  series = input.required<Series[]>();
  xLabel = input('t [min]');
  yLabel = input('');
  y2Label = input<string | null>(null);
  xMin = input<number | undefined>(undefined);
  xMax = input<number | undefined>(undefined);
  xStep = input<number | undefined>(undefined);
  yMin = input<number | undefined>(undefined);
  yMax = input<number | undefined>(undefined);
  y2Min = input<number | undefined>(undefined);
  y2Max = input<number | undefined>(undefined);
  markers = input<Marker[]>([]);
  bands = input<Band[]>([]);
  legend = input(true);
  height = input(320);
  ariaLabel = input('chart');

  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    afterRenderEffect(() => {
      const opts = {
        series: this.series(),
        xLabel: this.xLabel(), yLabel: this.yLabel(), y2Label: this.y2Label(),
        xMin: this.xMin(), xMax: this.xMax(), xStep: this.xStep(),
        yMin: this.yMin(), yMax: this.yMax(), y2Min: this.y2Min(), y2Max: this.y2Max(),
        legend: this.legend(),
      };
      untracked(() => this.build(opts));
    });
    afterRenderEffect(() => {
      const overlay: Overlay = { markers: this.markers(), bands: this.bands() };
      if (!this.chart) return;
      (this.chart as unknown as { $overlay: Overlay }).$overlay = overlay;
      this.chart.draw();
    });
  }

  private build(o: {
    series: Series[]; xLabel: string; yLabel: string; y2Label: string | null;
    xMin?: number; xMax?: number; xStep?: number; yMin?: number; yMax?: number;
    y2Min?: number; y2Max?: number; legend: boolean;
  }): void {
    const datasets = o.series.map(s => ({
      label: s.label,
      data: s.x.map((x, i) => ({ x, y: s.y[i] })),
      borderColor: s.color,
      backgroundColor: withAlpha(s.color, 0.6),
      borderDash: s.dash ?? [],
      borderWidth: s.width ?? 1.8,
      pointRadius: s.points ?? 0,
      pointHoverRadius: 3,
      pointBorderWidth: 0,
      tension: 0,
      spanGaps: false,
      clip: 6,
      yAxisID: s.axis ?? 'y',
      showInLegend: s.legend !== false,
    }));

    const grid = { color: 'rgba(29, 42, 51, 0.06)' };
    const scales: Record<string, object> = {
      x: {
        type: 'linear', min: o.xMin, max: o.xMax,
        ticks: o.xStep ? { stepSize: o.xStep } : { maxTicksLimit: 12 },
        title: { display: true, text: o.xLabel }, grid,
      },
      y: {
        min: o.yMin, max: o.yMax, ticks: { maxTicksLimit: 7 },
        title: { display: !!o.yLabel, text: o.yLabel }, grid,
      },
    };
    if (o.y2Label !== null) {
      scales['y2'] = {
        position: 'right', min: o.y2Min, max: o.y2Max, ticks: { maxTicksLimit: 7 },
        title: { display: true, text: o.y2Label }, grid: { drawOnChartArea: false },
      };
    }

    this.chart?.destroy();
    const xName = o.xLabel.split(' [')[0];
    const config: ChartConfiguration = {
      type: 'line',
      data: { datasets: datasets as never },
      plugins: [overlayPlugin],
      options: {
        animation: false,
        maintainAspectRatio: false,
        parsing: false,
        normalized: true,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        scales: scales as never,
        plugins: {
          legend: {
            display: o.legend,
            position: 'bottom',
            labels: {
              boxWidth: 18, boxHeight: 2,
              filter: (item, data) => (data.datasets[item.datasetIndex!] as { showInLegend?: boolean }).showInLegend !== false,
            },
          },
          tooltip: {
            filter: item => item.parsed.y !== null,
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toPrecision(4)}`,
              title: items => `${xName} = ${Number(items[0]?.parsed.x).toPrecision(4)}`,
            },
          },
        },
      },
    };
    const chart = new Chart(this.canvas().nativeElement, config);
    (chart as unknown as { $overlay: Overlay }).$overlay = {
      markers: untracked(this.markers),
      bands: untracked(this.bands),
    };
    chart.draw();
    this.chart = chart;
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}

/** Horizontal segments [x0, x1] at y, split into a solid and a dotted series by `ok`. */
export function steps(label: string, color: string, x0: number[], width: number, y: (number | null)[],
                      ok: boolean[], axis: 'y' | 'y2' = 'y', lineWidth = 3): Series[] {
  const solid: Series = { label, color, x: [], y: [], axis, width: lineWidth };
  const dotted: Series = { label: `${label} (not trusted)`, color, x: [], y: [], axis, width: lineWidth, dash: [2, 4], legend: false };
  x0.forEach((x, i) => {
    const target = ok[i] ? solid : dotted;
    target.x.push(x, x + width, x + width);
    target.y.push(y[i], y[i], null);
  });
  return [solid, dotted];
}
