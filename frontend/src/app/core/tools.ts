/**
 * Every tool of the app with the text behind its info button: what it does, how, the formulas,
 * and which of the original scripts it replaces.
 */
export interface ToolInfo {
  id: string;
  title: string;
  route: string;
  group: 'data' | 'analysis' | 'lab';
  lead: string;
  what: string;
  how: string[];
  formulas?: string[];
  scripts: string[];
  note?: string;
}

export const TOOLS: ToolInfo[] = [
  {
    id: 'record',
    title: 'Record',
    route: '/record',
    group: 'data',
    lead: 'Load the logger reports, see what is in them and where data is missing.',
    what:
      'Reads the Excel (or CSV) reports of the test stand: a timestamp and 23 channels. Several files are merged in ' +
      'time order, so a campaign split over two reports is analysed as one record.',
    how: [
      'Both naming variants of the reports are accepted (t1…t5 and t_1…t_5); a file without headers is read by column position, as the scripts did.',
      'Timestamps are read as dd.mm.yyyy HH:MM:SS; rows repeated in two files are kept once.',
      'Relative humidity logged in % is converted to a fraction.',
      'Enthalpy is computed at all five points, then Δi = i₂ − i₃ used by every COP tool.',
      'Gaps longer than 10 minutes and rows without supply/exhaust flags are listed.',
    ],
    formulas: [
      'x = 0.621945 · φ·p_ws(t) / (p − φ·p_ws(t))',
      'i = 1.006·t + x·(2501 + 1.86·t)   [kJ/kg dry air]',
    ],
    scripts: ['load_and_combine_data() in every script', 'HAPropsSI("H", …) row by row'],
  },
  {
    id: 'flags',
    title: 'Supply/exhaust flags',
    route: '/record',
    group: 'data',
    lead: 'Rebuild the half-cycle flags for the rows where the logger did not record them.',
    what:
      'Heat is counted only in the supply half-cycle, so rows without the nawiew/wywiew flags drop out of every COP. ' +
      'The flags switch every half-cycle, so they can be continued backwards from the first switch that was logged.',
    how: [
      'The half-cycle length is read off the logged part of the record (median time between switches).',
      'The anchor is the first logged switch after the missing rows; the state that starts there is known.',
      'A row n half-cycles before the anchor gets the opposite state for odd n and the same state for even n.',
      'Only rows without flags are written. The preview shows T2 next to the flags: the supply air warms up in the supply half-cycle, so the two must line up.',
    ],
    formulas: ['n = ⌈(t_anchor − t) / τ_half⌉,   supply(t) = supply(t_anchor) if n even, else the opposite'],
    scripts: ['uzupelnienie_nawiew_wywiew.py'],
    note:
      'The original loop compared each row with the time of the last switch after writing it and restarted the count ' +
      'at the row where it switched, so every reconstructed half-cycle came out one sample longer and the phase drifted ' +
      'going back in time. Here every switch is exactly τ_half apart (tested).',
  },
  {
    id: 'windows',
    title: 'Measurement windows',
    route: '/record',
    group: 'data',
    lead: 'Check whether the hand-picked windows are in the record, or let the record propose steady ones.',
    what:
      'The detailed analysis works on 30-minute windows of steady operation. The windows used so far were picked by hand ' +
      'and then looked up in the report files.',
    how: [
      'Check: each window is looked up with a tolerance on its start; coverage, the longest gap, the share of rows with flags and with the compressor running are reported.',
      'Suggest: every 30-minute window of the record is scored. It has to be fully logged, with flags and the compressor setpoint ≥ 0.20 throughout; the score is the spread of T3 plus the spread of the compressor power.',
      'The outdoor-temperature range of the record is split into bands and the steadiest window of each band is kept, so the set covers the whole range (as needed for COP against T3).',
    ],
    formulas: ['score = σ(T3) [K] + σ(P_comp) [W] / 200'],
    scripts: ['szykanie_dat.py'],
  },
  {
    id: 'overview',
    title: 'Whole record',
    route: '/overview',
    group: 'analysis',
    lead: 'Running COP over the whole campaign, outdoor temperature and refrigerant pressures.',
    what:
      'The first plots of the analysis: everything from the first row to the last, to see where the unit ran, where the ' +
      'compressor was off and where the logger stopped.',
    how: [
      'Q and W are summed from the first row; COP at each row is ΣQ / ΣW so far, smoothed over 10 samples.',
      'Only rows with the compressor setpoint above zero count; heat only in the supply half-cycle.',
      'As in the scripts, the constant 0.45 kW is added on exhaust rows only.',
      'Grey bands: compressor power zero for more than 2 h. Red bands: no data.',
      'Long records are averaged into ~1500 points for the browser.',
    ],
    formulas: [
      'Q = 0.389 · Δi · Δt   (supply rows)',
      'W = P_comp · Δt [+ 0.45 kW · Δt on exhaust rows]',
      'COP(t) = ΣQ / ΣW',
    ],
    scripts: ['3_poczatkowe_wykresy.py', '3pocz_wykresyX.py', 'nowy_skumulowane4.py', 'skumulowany_5najnowszy.py'],
    note:
      'Δt is the time since the previous row, so the first row after a logging gap carries the whole gap: one sample ' +
      'can add hours of heat. The jump in the running COP after a gap comes from that.',
  },
  {
    id: 'window',
    title: '30-minute window',
    route: '/window',
    group: 'analysis',
    lead: 'Temperatures, humidity, enthalpy, pressures, running COP and superheat in one window.',
    what:
      'The detailed plots of one window of steady operation. The regular oscillation of every quantity comes from the ' +
      'fan reversing every 60 s; how even it is shows how steady the unit runs.',
    how: [
      'T1–T5, RH1–RH5 and i1–i5 keep one colour per measuring point on every chart.',
      'Running COP inside the window: ΣQ / ΣW from the window start, for the compressor alone and with the constant power.',
      'Refrigerant side: evaporating and condensing temperatures from the pressures (R290, CoolProp) next to the controller values, and the suction superheat.',
    ],
    formulas: [
      't_evap = T_sat(p_suction + p_atm),  t_cond = T_sat(p_discharge + p_atm)',
      'superheat = t_suction − t_evap',
    ],
    scripts: ['wszystkie_wykr_2.py', 'dodatkowe_COP.py', 'wszystkieBezCOP2.py'],
  },
  {
    id: 'cycle',
    title: 'One cycle',
    route: '/cycle',
    group: 'analysis',
    lead: 'A single 120-second cycle: 60 s supply and 60 s exhaust, second by second.',
    what:
      'The close-up the instantaneous COP is built on. In the supply half-cycle m·(i₂ − i₃) is the heating capacity ' +
      'of the unit; in the exhaust half-cycle the regenerator is charged and no heat is delivered.',
    how: [
      'The start snaps to the next beginning of a supply half-cycle (switch it off to start anywhere).',
      'The four panels are the ones of the original 2 × 2 figure: temperatures, humidity, enthalpy, pressures.',
      'Below: heating capacity in the supply phase and electrical power over the cycle, and the cycle totals.',
    ],
    formulas: ['Q̇ = flow · (i₂ − i₃)   (supply)', 'COP_cycle = ∫Q̇ dt / ∫P dt'],
    scripts: ['120sPRZEDZIALY_new.py'],
  },
  {
    id: 'cop',
    title: 'COP in 2-minute blocks',
    route: '/cop',
    group: 'analysis',
    lead: 'COP per cycle-long block, with and without the fan and automation, for one window.',
    what:
      'The COP plots of the thesis. One block of 2 minutes holds one supply and one exhaust half-cycle, so the COP of a ' +
      'block is close to the COP of a cycle.',
    how: [
      'Q and W are summed in clock-aligned 2-minute blocks (pandas resample "2min", as in the scripts).',
      'Blue: COP of the compressor alone. Green: COP with the constant 0.45 kW of the fan and automation. Red: compressor power.',
      'A block is not trusted when the highest compressor setpoint in it is below 0.20 or its COP is outside 1.5–12; it is drawn dotted at the level of the previous trusted block.',
      'Blocks cut by the window edges are drawn, but left out of the averages.',
    ],
    formulas: [
      'Q = 0.389 · Δi · Δt   (supply, setpoint > 0)',
      'W_comp = P_comp · Δt,   W = (P_comp + 0.45 kW) · Δt   (both half-cycles)',
      'COP_comp = Q / W_comp,   COP = Q / W',
    ],
    scripts: ['cop_blokowe30minTEST.py', 'cop_blok30min_nowszy.py'],
  },
];

export function tool(id: string): ToolInfo {
  const t = TOOLS.find(x => x.id === id);
  if (!t) throw new Error(`unknown tool ${id}`);
  return t;
}
