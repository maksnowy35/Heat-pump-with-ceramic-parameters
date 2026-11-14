/** Windows picked by hand in the original analysis, with the scripts that used them. */
export interface Preset {
  start: string;
  minutes: number;
  from: string[];
}

const W30: [string, string[]][] = [
  ['2025-02-22T08:24:58', ['wszystkie_wykr_2', 'dodatkowe_COP', 'cop_blokowe30minTEST']],
  ['2025-02-22T23:06:17', ['wszystkie_wykr_2', 'dodatkowe_COP']],
  ['2025-02-23T01:15:00', ['cop_blok30min_nowszy']],
  ['2025-02-24T02:45:01', ['cop_blok30min_nowszy']],
  ['2025-02-25T07:40:50', ['wszystkie_wykr_2', 'dodatkowe_COP']],
  ['2025-02-26T05:33:19', ['cop_blok30min_nowszy']],
  ['2025-02-26T08:09:40', ['cop_blokowe30minTEST']],
  ['2025-02-27T04:59:41', ['cop_blok30min_nowszy']],
  ['2025-02-27T10:48:13', ['wszystkie_wykr_2', 'dodatkowe_COP']],
  ['2025-03-01T05:33:14', ['cop_blok30min_nowszy']],
  ['2025-03-02T07:54:29', ['cop_blokowe30minTEST']],
  ['2025-03-04T16:35:59', ['wszystkie_wykr_2', 'dodatkowe_COP']],
  ['2025-03-05T18:09:01', ['wszystkie_wykr_2', 'dodatkowe_COP']],
  ['2025-03-05T23:41:48', ['cop_blok30min_nowszy']],
  ['2025-03-06T07:39:12', ['cop_blokowe30minTEST']],
  ['2025-03-10T06:53:58', ['cop_blokowe30minTEST']],
  ['2025-03-17T08:37:34', ['cop_blok30min_nowszy']],
  ['2025-03-25T17:13:02', ['cop_blok30min_nowszy', 'wszystkieBezCOP2']],
];

export const WINDOWS_30: Preset[] = W30.map(([start, from]) => ({ start, minutes: 30, from }));

export function inRecord(p: Preset, start: string, end: string): boolean {
  return p.start >= start.slice(0, 19) && p.start < end.slice(0, 19);
}
