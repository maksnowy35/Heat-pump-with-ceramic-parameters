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
      'Corrected mode: mass flow 0.468 kg/s, the constant power on every row, the time step capped at 10 s after a gap.',
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
      'Corrected mode: mass flow 0.468 kg/s instead of 0.389 and one block per cycle, from the start of its supply half-cycle.',
    ],
    formulas: [
      'Q = 0.389 · Δi · Δt   (supply, setpoint > 0)',
      'W_comp = P_comp · Δt,   W = (P_comp + 0.45 kW) · Δt   (both half-cycles)',
      'COP_comp = Q / W_comp,   COP = Q / W',
    ],
    scripts: ['cop_blokowe30minTEST.py', 'cop_blok30min_nowszy.py'],
  },
  {
    id: 'cop-tout',
    title: 'COP against outdoor temperature',
    route: '/cop',
    group: 'analysis',
    lead: 'One point per steady window: how the COP changes with T3.',
    what:
      'The summary of the window analysis (section 4.3 of the thesis, Fig. 15 of the paper): the mean block COP of each ' +
      'steady window against its mean outdoor temperature.',
    how: [
      'By default the steady windows proposed for the record are used, spread over its T3 range.',
      'Each point is the mean over the complete, trusted 2-minute blocks of the window.',
      'Grey bars: the COP ranges read from the measured windows in section 4.3 of the thesis, for comparison.',
    ],
    formulas: ['COP_window = mean(COP_block)   over trusted, complete blocks'],
    scripts: ['the summary table in section 4.3, made by hand from the block plots'],
  },
  {
    id: 'ntc',
    title: 'NTC characteristic',
    route: '/ntc',
    group: 'lab',
    lead: 'Temperature from the resistance of an NTC thermistor: table, Beta and Steinhart–Hart.',
    what:
      'The air temperatures are measured with NTC thermistors. This tool turns a measured current or resistance into ' +
      'a temperature and compares the ways of reading the R–T characteristic.',
    how: [
      'Default: the 5 kΩ (Tn5) table of the original script, −20…100 °C. Paste another table as "t; R" lines.',
      'Linear: straight lines between table points in R, as the script did; clamped to the ends of the table.',
      'Logarithmic: straight lines in ln R against 1/T, i.e. a Beta curve per interval; exact at the table points and the right shape in between.',
      'Beta and Steinhart–Hart are fitted to the whole table by least squares.',
      'B constants are computed from the table and compared with the datasheet.',
    ],
    formulas: [
      'R = U / I',
      'R = R₂₅ · exp(B·(1/T − 1/T₂₅))',
      '1/T = A + B·ln R + C·(ln R)³',
      'B₂₅/ₓ = ln(R₂₅/Rₓ) / (1/T₂₅ − 1/Tₓ)',
    ],
    scripts: ['NTC5k_characterisitc.py'],
    note:
      'Between table points 10 K apart, linear interpolation in R reads 0.4–0.7 K too warm, because R falls exponentially ' +
      'with temperature. That is more than the ±0.425 K class B tolerance of the sensors; interpolating ln R against 1/T removes it.',
  },
  {
    id: 'modbus',
    title: 'Modbus RTU',
    route: '/modbus',
    group: 'lab',
    lead: 'Find the controller on the RS-485 bus, read and write its registers, see every frame.',
    what:
      'The logger reads the controller over Modbus RTU. These are the two helper scripts used while setting it up: ' +
      'a scan for the unit id and a read/write of single registers.',
    how: [
      'Scan: for every unit id in the range, read one input register, then one holding register; the first answer wins.',
      'Read: function 04 (input) or 03 (holding), any address and count.',
      'Write: function 06, one holding register; the controller echoes the request.',
      'Every request and response is shown byte by byte, with the CRC-16/MODBUS.',
      'Without a serial port configured (MODBUS_PORT), the API answers from a simulated controller at unit id 1. On a real port writing is off unless MODBUS_ALLOW_WRITE=1.',
    ],
    formulas: [
      'request = [unit][function][address hi lo][count hi lo][CRC lo hi]',
      'CRC-16/MODBUS: init 0xFFFF, polynomial 0xA001 (reflected)',
    ],
    scripts: ['szukanie_modnusa.py', 'Zmiana_rejestrow.py'],
  },
  {
    id: 'regenerator',
    title: 'Ceramic regenerator',
    route: '/regenerator',
    group: 'lab',
    lead: 'Channel geometry, heat transfer, pressure drop, fan power and time constant of the ceramic blocks.',
    what:
      'The calculation of section 4.4 of the thesis: 30 honeycomb blocks in two rows, 60 × 60 square channels each, ' +
      'laminar air flow. Change the geometry or the air flow and every number follows.',
    how: [
      'Channel pitch from the inner block width, channel side 8 × the wall thickness.',
      'Laminar, fully developed flow in square ducts: Nu = 3.61, f·Re = 56.9.',
      'Pressure drop by Darcy–Weisbach, without minor losses; fan power at 50 % efficiency.',
      'Heat capacity from the block masses and c_p = 880 J/(kg K) (99.5 kJ/K, as in the paper), or the 95 kJ/K of the thesis.',
      'The thesis column shows the printed values next to the computed ones.',
    ],
    formulas: [
      'p = L_in / 60,  t = p / 9,  a = 8p / 9',
      'Re = ρ·v·a / μ,  h = Nu·k / a,  NTU = h·A / (ṁ·c_p)',
      'Δp = f·(L/a)·ρv²/2,  f = 56.9 / Re',
      'τ = C / (h·A)',
    ],
    scripts: ['section 4.4 of the thesis (calculated by hand)'],
  },
];

export function tool(id: string): ToolInfo {
  const t = TOOLS.find(x => x.id === id);
  if (!t) throw new Error(`unknown tool ${id}`);
  return t;
}
