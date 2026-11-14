import { Band, Series } from '../shared/chart';
import { Num, WindowResponse } from './models';
import { OCHRE, channelColor, withAlpha } from './palette';

export function xAxis(r: WindowResponse, divisor: number): number[] {
  return r.seconds.map(s => (s ?? 0) / divisor);
}

/** T1..T5, RH1..RH5 or i1..i5 - one colour per measuring point. */
export function points(r: WindowResponse, x: number[], keys: string[], label: (k: number) => string, scale = 1): Series[] {
  return keys.map((key, i) => ({
    label: label(i + 1),
    x,
    y: (r.series[key] ?? []).map(v => (v === null ? null : v * scale)),
    color: channelColor(i + 1),
  }));
}

export function mean(values: Num[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Shaded bands where the supply flag is set. */
export function supplyBands(r: WindowResponse, x: number[]): Band[] {
  const out: Band[] = [];
  let from: number | null = null;
  r.supply.forEach((s, i) => {
    if (s === 1 && from === null) from = x[i];
    if (s !== 1 && from !== null) {
      out.push({ from, to: x[i], color: withAlpha(OCHRE, 0.13), label: 'supply' });
      from = null;
    }
  });
  if (from !== null) out.push({ from, to: x[x.length - 1], color: withAlpha(OCHRE, 0.13), label: 'supply' });
  return out;
}
