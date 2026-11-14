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
