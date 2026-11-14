/** Engineering-ish number formatting for tables. */
export function num(v: number | null | undefined, digits = 3): string {
  if (v === null || v === undefined || !isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-2 || a >= 1e5)) {
    const [m, e] = v.toExponential(digits - 1).split('e');
    return `${m}·10${superscript(Number(e))}`;
  }
  return Number(v.toPrecision(digits)).toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** Fixed decimals, '–' for missing values. */
export function fix(v: number | null | undefined, decimals = 2): string {
  return v === null || v === undefined || !isFinite(v) ? '–' : v.toFixed(decimals);
}

function superscript(n: number): string {
  const map: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(n).split('').map(ch => map[ch] ?? ch).join('');
}

export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)} %`;
}

export function eventValue(e: Event): number {
  return Number((e.target as HTMLInputElement).value);
}

export function eventText(e: Event): string {
  return (e.target as HTMLInputElement).value;
}

/** "2025-02-22T08:24:58" -> "22.02.2025 08:24:58", the format of the logger reports. */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return '–';
  const [d, t = ''] = iso.split('T');
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y} ${t.slice(0, 8)}`.trim();
}

/** Value for <input type="datetime-local" step="1"> */
export function localInput(iso: string): string {
  return iso.slice(0, 19);
}

export function addMinutes(iso: string, minutes: number): string {
  const t = new Date(iso.slice(0, 19) + 'Z').getTime() + minutes * 60_000;
  return new Date(t).toISOString().slice(0, 19);
}

export function downloadCsv(filename: string, header: string[], rows: (number | string | null)[][]): void {
  const text = [header.join(','), ...rows.map(r => r.map(v => (v === null ? '' : v)).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function errorMessage(err: { error?: { detail?: unknown }; status?: number }): string {
  if (err.status === 0) return 'The API is not reachable. Start the backend: uvicorn app.main:app --reload';
  const d = err.error?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg);
  return 'The request was rejected by the API.';
}
