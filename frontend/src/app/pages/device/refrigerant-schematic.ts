import { Component, computed, signal } from '@angular/core';

interface Probe {
  id: string;
  x: number;
  y: number;
  side: 'up' | 'left';
  label: string;
  text: string;
}

const PROBES: Probe[] = [
  { id: 'td', x: 270, y: 70, side: 'up', label: 't', text: 'Discharge temperature (t_tloczenie)' },
  { id: 'pd', x: 320, y: 70, side: 'up', label: 'p', text: 'Discharge pressure, Carel SPKT0041 (p_tloczenia, bar(g)) → condensing temperature of R290' },
  { id: 'hp', x: 370, y: 70, side: 'up', label: 'HP', text: 'High-pressure switch (presostat tłoczenia), safety only' },
  { id: 'ts', x: 120, y: 190, side: 'left', label: 't', text: 'Suction temperature (t_ssania); minus the evaporating temperature it gives the superheat' },
  { id: 'ps', x: 120, y: 240, side: 'left', label: 'p', text: 'Suction pressure, Carel SPKT0041 (p_ssania, bar(g)) → evaporating temperature of R290' },
  { id: 'lp', x: 120, y: 290, side: 'left', label: 'LP', text: 'Low-pressure switch (presostat ssania), safety only' },
];

function head(p: Probe): { x: number; y: number } {
  return p.side === 'up' ? { x: p.x, y: p.y - 30 } : { x: p.x - 34, y: p.y };
}

/** R290 circuit in heating mode. */
@Component({
  selector: 'app-refrigerant-schematic',
  template: `
    <svg viewBox="0 0 620 400" role="img" aria-label="R290 refrigerant circuit in heating mode">
      <defs>
        <marker id="arr-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" class="ah-r" />
        </marker>
      </defs>
      <!-- discharge: compressor -> 4-way valve -> indoor exchanger -->
      <path d="M200,203 L200,152" class="pipe hot" />
      <path d="M200,118 L200,70 L460,70 L460,108" class="pipe hot" marker-end="url(#arr-r)" />
      <!-- liquid: condenser -> receiver -> expansion valve -->
      <path d="M460,190 L460,240 L540,240 L540,248" class="pipe liquid" marker-end="url(#arr-r)" />
      <path d="M540,300 L540,330 L442,330" class="pipe liquid" marker-end="url(#arr-r)" />
      <!-- two-phase: expansion valve -> evaporator -->
      <path d="M398,330 L332,330" class="pipe cold" marker-end="url(#arr-r)" />
      <!-- suction: evaporator -> 4-way valve -> compressor -->
      <path d="M210,330 L120,330 L120,135 L176,135" class="pipe cold" marker-end="url(#arr-r)" />
      <path d="M222,135 L265,135 L265,235 L234,235" class="pipe cold" marker-end="url(#arr-r)" />

      <!-- 4-way valve -->
      <rect x="178" y="118" width="44" height="34" rx="3" class="box valve4" />
      <path d="M186,128 L214,142 M186,142 L214,128" class="valve-x" />
      <text x="190" y="98" class="cap sub r">4-way valve</text>
      <text x="190" y="110" class="cap sub muted r">reverses the cycle for cooling</text>

      <!-- compressor + inverter -->
      <circle cx="200" cy="235" r="32" class="comp" />
      <path d="M180,217 L222,235 L180,253" class="comp-sym" />
      <text x="275" y="232" class="cap l">compressor</text>
      <line x1="200" y1="267" x2="200" y2="290" class="wire" />
      <rect x="176" y="290" width="48" height="24" rx="3" class="box" />
      <text x="200" y="306" class="cap sub">inverter</text>

      <!-- indoor exchanger = condenser -->
      <rect x="420" y="110" width="80" height="80" rx="3" class="hx" />
      @for (k of [0, 1, 2, 3, 4, 5]; track k) { <line x1="420" [attr.y1]="122 + k * 12" x2="500" [attr.y2]="122 + k * 12" class="fin" /> }
      <text x="510" y="132" class="cap l">indoor exchanger</text>
      <text x="510" y="147" class="cap sub l">condenser,</text>
      <text x="510" y="160" class="cap sub l">heats the supply air</text>

      <!-- receiver -->
      <rect x="525" y="250" width="30" height="50" rx="12" class="recv" />
      <text x="563" y="279" class="cap sub l">receiver</text>

      <!-- expansion valve -->
      <path d="M400,320 L420,330 L400,340 Z M440,320 L420,330 L440,340 Z" class="eev" />
      <text x="420" y="358" class="cap sub">EEV (AKV)</text>

      <!-- outdoor exchanger = evaporator -->
      <rect x="210" y="312" width="120" height="36" rx="3" class="hx cold-hx" />
      @for (k of [0, 1, 2, 3, 4, 5, 6, 7]; track k) { <line [attr.x1]="222 + k * 14" y1="312" [attr.x2]="222 + k * 14" y2="348" class="fin" /> }
      <text x="270" y="366" class="cap">outdoor exchanger</text>
      <text x="270" y="379" class="cap sub">evaporator, takes heat from the air</text>

      <!-- probes -->
      @for (p of probes; track p.id) {
        <g class="probe" [class.on]="active() === p.id" tabindex="0" role="button" [attr.aria-label]="p.text"
           (mouseenter)="active.set(p.id)" (focus)="active.set(p.id)" (click)="active.set(p.id)">
          <line [attr.x1]="p.x" [attr.y1]="p.y" [attr.x2]="p.side === 'up' ? p.x : p.x - 22" [attr.y2]="p.side === 'up' ? p.y - 18 : p.y" />
          <circle [attr.cx]="headOf(p).x" [attr.cy]="headOf(p).y" r="12" />
          <text [attr.x]="headOf(p).x" [attr.y]="headOf(p).y + 4">{{ p.label }}</text>
        </g>
      }
      <text x="320" y="16" class="cap sub muted">discharge line, hot gas</text>
      <text x="86" y="358" class="cap sub muted">suction line</text>
    </svg>
    <p class="sensor-text">{{ text() }}</p>
  `,
  styleUrl: './schematic.scss',
})
export class RefrigerantSchematic {
  readonly probes = PROBES;
  active = signal('ps');
  readonly headOf = head;
  text = computed(() => PROBES.find(p => p.id === this.active())?.text ?? '');
}
