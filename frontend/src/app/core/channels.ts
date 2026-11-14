/** Logger channels: column name in the report, symbol, unit and meaning. */
export interface Channel {
  column: string;
  symbol: string;
  unit: string;
  meaning: string;
  group: 'air' | 'refrigerant' | 'electrical' | 'control';
}

export const CHANNELS: Channel[] = [
  { column: 't1', symbol: 'T1', unit: '°C', meaning: 'air temperature, point 1', group: 'air' },
  { column: 't2', symbol: 'T2', unit: '°C', meaning: 'air temperature, point 2, supply side of the indoor exchanger', group: 'air' },
  { column: 't3', symbol: 'T3', unit: '°C', meaning: 'air temperature, point 3, outdoor air', group: 'air' },
  { column: 't4', symbol: 'T4', unit: '°C', meaning: 'air temperature, point 4', group: 'air' },
  { column: 't5', symbol: 'T5', unit: '°C', meaning: 'air temperature, point 5, at the fan', group: 'air' },
  { column: 'rh_1', symbol: 'RH1', unit: '–', meaning: 'relative humidity, point 1', group: 'air' },
  { column: 'rh_2', symbol: 'RH2', unit: '–', meaning: 'relative humidity, point 2', group: 'air' },
  { column: 'rh_3', symbol: 'RH3', unit: '–', meaning: 'relative humidity, point 3', group: 'air' },
  { column: 'rh_4', symbol: 'RH4', unit: '–', meaning: 'relative humidity, point 4', group: 'air' },
  { column: 'rh_5', symbol: 'RH5', unit: '–', meaning: 'relative humidity, point 5', group: 'air' },
  { column: 't_ssania', symbol: 't_suc', unit: '°C', meaning: 'refrigerant at the compressor suction', group: 'refrigerant' },
  { column: 't_tloczenie', symbol: 't_dis', unit: '°C', meaning: 'refrigerant at the compressor discharge', group: 'refrigerant' },
  { column: 'p_ssania', symbol: 'p_suc', unit: 'bar(g)', meaning: 'suction pressure', group: 'refrigerant' },
  { column: 'p_tloczenia', symbol: 'p_dis', unit: 'bar(g)', meaning: 'discharge pressure', group: 'refrigerant' },
  { column: 't_parowania', symbol: 't_evap', unit: '°C', meaning: 'evaporating temperature (controller)', group: 'refrigerant' },
  { column: 't_skraplania', symbol: 't_cond', unit: '°C', meaning: 'condensing temperature (controller)', group: 'refrigerant' },
  { column: 'Moc_Czynna', symbol: 'P', unit: 'W', meaning: 'compressor active power', group: 'electrical' },
  { column: 'Moc_Bierna', symbol: 'Q', unit: 'var', meaning: 'compressor reactive power', group: 'electrical' },
  { column: 'Moc_Pozorna', symbol: 'S', unit: 'VA', meaning: 'compressor apparent power', group: 'electrical' },
  { column: 'predkosc_wentylatora', symbol: 'n_fan', unit: '%', meaning: 'fan speed', group: 'control' },
  { column: 'nast_spr', symbol: 'u_comp', unit: '–', meaning: 'compressor setpoint, 0–1', group: 'control' },
  { column: 'nawiew', symbol: 'supply', unit: '0/1', meaning: 'supply half-cycle', group: 'control' },
  { column: 'wywiew', symbol: 'exhaust', unit: '0/1', meaning: 'exhaust half-cycle', group: 'control' },
];
