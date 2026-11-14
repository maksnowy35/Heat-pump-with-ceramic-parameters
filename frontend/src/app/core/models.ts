export type Num = number | null;

export interface CopParams {
  flow: number;
  aux_kw: number;
  min_setpoint: number;
  cop_min: number;
  cop_max: number;
}

export const DEFAULT_COP: CopParams = { flow: 0.389, aux_kw: 0.45, min_setpoint: 0.2, cop_min: 1.5, cop_max: 12 };

export interface Gap {
  start: string;
  end: string;
  hours: number;
}

export interface DatasetInfo {
  id: string;
  name: string;
  source: 'demo' | 'upload';
  files: string[];
  created: string;
  rows: number;
  start: string;
  end: string;
  sampling_s: number;
  gaps: Gap[];
  missing_flags: number;
  compressor_on: number;
  t_out_min: Num;
  t_out_max: Num;
  completeness: Record<string, number>;
}

export interface Block {
  start: string;
  minutes: number;
  q_kwh: number;
  w_kwh: number;
  w_total_kwh: number;
  setpoint: Num;
  p_comp: Num;
  t_out: Num;
  cop: Num;
  cop_total: Num;
  valid: boolean;
  valid_total: boolean;
  complete: boolean;
  cop_plot: Num;
  cop_total_plot: Num;
}

export interface BlockSummary {
  blocks: number;
  valid: number;
  cop: Num;
  cop_total: Num;
  cop_total_energy: Num;
  p_comp: Num;
  t_out: Num;
}

export interface BlocksResponse {
  start: string;
  end: string;
  blocks: Block[];
  summary: BlockSummary;
}

export interface Segment {
  start: number;
  end: number;
}

export interface CumulativeResponse {
  origin: string;
  hours: Num[];
  cop: Num[];
  cop_total: Num[];
  t3: Num[];
  p_suction: Num[];
  p_discharge: Num[];
  off: Segment[];
  gaps: Segment[];
  final_cop: Num;
  final_cop_total: Num;
}

export interface CycleTotals {
  q_kwh: number;
  w_kwh: number;
  w_total_kwh: number;
  cop: Num;
  cop_total: Num;
}

export interface WindowResponse {
  start: string;
  end: string;
  rows: number;
  seconds: Num[];
  supply: Num[];
  series: Record<string, Num[]>;
  totals: CycleTotals;
}

export interface PhasePlan {
  anchor: string;
  supply: boolean;
  half_s: number;
}

export interface PhaseSuggestion {
  plan: PhasePlan | null;
  missing: number;
  half_s_logged: Num;
}

export interface PhasePreview {
  seconds: Num[];
  t2: Num[];
  supply_logged: Num[];
  supply_rebuilt: Num[];
  origin: string;
  filled: number;
}

export interface Coverage {
  start: string;
  end: string;
  first: string | null;
  rows: number;
  coverage: number;
  max_gap_s: number;
  flags: number;
  compressor: number;
  t3_mean: Num;
  t3_std: Num;
  status: 'ok' | 'partial' | 'missing';
}

export interface Candidate {
  start: string;
  minutes: number;
  t3_mean: number;
  t3_std: number;
  p_std: number;
  score: number;
}

export interface CopTPoint {
  start: string;
  t_out: Num;
  cop: Num;
  cop_total: Num;
  p_comp: Num;
  valid: number;
  blocks: number;
}

export interface NtcModel {
  name: string;
  params: Record<string, number>;
  max_error: number;
}

export interface NtcResponse {
  table: [number, number][];
  models: NtcModel[];
  b_values: Record<string, number>;
  datasheet_b: Record<string, number>;
  curve_t: number[];
  curve_r: Record<string, number[]>;
  interp_t: number[];
  interp_error: number[];
  reading: { resistance: number; t_linear: Num; t_log: Num; t_beta: number; t_steinhart_hart: number } | null;
}

export interface ModbusStatus {
  port: string;
  simulated: boolean;
  baudrate: number;
  parity: string;
  timeout: number;
  writes_allowed: boolean;
}

export interface FrameByte {
  hex: string;
  field: string;
}

export interface ModbusExchange {
  ok: boolean;
  values: number[];
  error: string | null;
  request: string;
  response: string | null;
  request_fields: FrameByte[];
  response_fields: FrameByte[];
}

export interface ScanHit {
  unit: number;
  kind: string;
  value: number;
}

export interface RegeneratorRequest {
  mass_flow: number;
  cells: number;
  channel_to_wall: number;
  length_top: number;
  length_bottom: number;
  heat_capacity: number | null;
  half_cycle: number;
  fan_efficiency: number;
}

export interface RegeneratorResponse {
  values: Record<string, number>;
  rows: { name: string; n_channels: number; wetted_area: number; hA: number; dp: number; heat_capacity: number }[];
  thesis: Record<string, number>;
  curve_t: number[];
  captured_tau: number[];
  captured_bed: number[];
}
