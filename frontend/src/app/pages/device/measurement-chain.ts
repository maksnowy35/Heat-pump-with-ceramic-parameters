import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Stage {
  title: string;
  items: string[];
  link?: { route: string; label: string };
}

const STAGES: Stage[] = [
  {
    title: 'Sensors',
    items: ['5 × NTC, class B', '5 × SHT20 humidity', '2 × Carel SPKT pressure', 'Lumel N27P power meter', 'IRIS 250 + DPT250-R8 air flow'],
    link: { route: '/ntc', label: 'NTC tool' },
  },
  {
    title: 'Controller',
    items: ['compressor PID, EEV', 'fan reversal every 60 s', 'Modbus RTU slave'],
  },
  {
    title: 'RS-485',
    items: ['Modbus RTU', '19200 baud, 8N1', 'USB adapter (COM8)'],
    link: { route: '/modbus', label: 'Modbus tool' },
  },
  {
    title: 'Logger',
    items: ['reads the registers', 'one row every ~2 s', 'Excel report, 24 columns'],
    link: { route: '/record', label: 'Record' },
  },
  {
    title: 'Analysis',
    items: ['enthalpy at 5 points', 'supply/exhaust flags', 'windows, COP, superheat'],
    link: { route: '/cop', label: 'COP' },
  },
];

@Component({
  selector: 'app-measurement-chain',
  imports: [RouterLink],
  template: `
    <ol class="chain">
      @for (s of stages; track s.title; let last = $last) {
        <li>
          <h4>{{ s.title }}</h4>
          <ul>
            @for (i of s.items; track i) { <li>{{ i }}</li> }
          </ul>
          @if (s.link) { <a [routerLink]="s.link.route">{{ s.link.label }} →</a> }
        </li>
      }
    </ol>
  `,
  styles: `
    .chain { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1.6rem; }
    .chain > li { position: relative; background: var(--panel); border: 1px solid var(--rule); border-radius: var(--radius);
                  padding: 0.7rem 0.8rem; font-size: 0.86rem; }
    .chain > li:not(:last-child)::after { content: '→'; position: absolute; right: -1.25rem; top: 50%; transform: translateY(-50%);
                                         color: var(--steel); font-size: 1.1rem; }
    h4 { margin: 0 0 0.3rem; font-family: var(--font-display); font-size: 1rem; }
    ul { margin: 0 0 0.4rem; padding-left: 1rem; color: var(--steel); }
    a { font-size: 0.82rem; }
    @media (max-width: 1000px) {
      .chain { grid-template-columns: 1fr; gap: 1.2rem; }
      .chain > li:not(:last-child)::after { content: '↓'; right: 50%; top: auto; bottom: -1.2rem; transform: none; }
    }
  `,
})
export class MeasurementChain {
  readonly stages = STAGES;
}
