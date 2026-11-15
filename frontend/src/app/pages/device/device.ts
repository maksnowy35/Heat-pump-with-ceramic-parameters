import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CeramicBlock } from '../regenerator/ceramic-block';
import { CycleTimeline } from './cycle-timeline';
import { MeasurementChain } from './measurement-chain';
import { RefrigerantSchematic } from './refrigerant-schematic';
import { UnitSchematic } from './unit-schematic';

const INSTRUMENTS = [
  { quantity: 'Air temperature', instrument: 'NTC thermistor, class B', limit: '±0.425 °C', u: '0.245 °C' },
  { quantity: 'Relative humidity', instrument: 'SHT20', limit: '±3 % RH (20–80 %), ±4.5 % outside', u: '1.732 % RH' },
  { quantity: 'Air flow', instrument: 'IRIS 250 damper', limit: '±5 %', u: '2.887 %' },
  { quantity: 'Air differential pressure', instrument: 'HK Instruments DPT250-R8', limit: '±1 % of range', u: '±8 Pa' },
  { quantity: 'Refrigerant pressure', instrument: 'Carel SPKT0041-DO', limit: '±1 %', u: '±0.182 bar' },
  { quantity: 'Electrical power', instrument: 'Lumel N27P', limit: '±0.2 % of range', u: '1.732 W' },
];

@Component({
  selector: 'app-device',
  imports: [UnitSchematic, RefrigerantSchematic, CycleTimeline, MeasurementChain, CeramicBlock, RouterLink],
  templateUrl: './device.html',
  styleUrl: './device.scss',
})
export class DevicePage {
  readonly instruments = INSTRUMENTS;
}
