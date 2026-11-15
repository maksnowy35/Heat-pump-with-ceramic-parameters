import { Component, computed, signal } from '@angular/core';

interface Sensor {
  id: number;
  x: number;
  y: number;
  text: string;
}

const SENSORS: Sensor[] = [
  { id: 1, x: 118, y: 196, text: 'T1 / RH1 – room side of the unit (t1, rh_1)' },
  { id: 2, x: 118, y: 62, text: 'T2 / RH2 – at the indoor exchanger; i₂ − i₃ gives the heating capacity (t2, rh_2)' },
  { id: 3, x: 262, y: 118, text: 'T3 / RH3 – outdoor air, the outdoor temperature of every analysis (t3, rh_3)' },
  { id: 4, x: 302, y: 258, text: 'T4 / RH4 – between the outdoor exchanger and the ceramic blocks (t4, rh_4)' },
  { id: 5, x: 268, y: 400, text: 'T5 / RH5 – at the fan (t5, rh_5)' },
];

/** Air side of the unit, laid out after Fig. 1 of the thesis. */
@Component({
  selector: 'app-unit-schematic',
  template: `
    <div class="bar">
      <div class="segmented" role="group" aria-label="Half-cycle">
        <button type="button" [class.on]="phase() === 'supply'" (click)="phase.set('supply')">supply (nawiew)</button>
        <button type="button" [class.on]="phase() === 'exhaust'" (click)="phase.set('exhaust')">exhaust (wywiew)</button>
      </div>
    </div>
    <svg viewBox="0 0 560 450" role="img" aria-label="Schematic of the ventilation unit with the measuring points">
      <defs>
        <marker id="arr-s" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" class="ah-s" />
        </marker>
        <marker id="arr-e" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" class="ah-e" />
        </marker>
      </defs>

      <!-- wall and room -->
      <text x="20" y="438" class="zone">ROOM</text>
      <text x="470" y="438" class="zone">OUTSIDE</text>
      <rect x="438" y="20" width="14" height="400" class="wall" />

      <!-- housing -->
      <rect x="60" y="30" width="270" height="390" rx="6" class="housing" />

      <!-- indoor exchanger -->
      <g class="hx">
        <rect x="75" y="78" width="125" height="46" rx="3" />
        @for (k of fins; track k) { <line [attr.x1]="75" [attr.y1]="84 + k * 5" [attr.x2]="200" [attr.y2]="84 + k * 5" /> }
      </g>
      <text x="138" y="140" class="cap">indoor exchanger</text>
      <text x="138" y="152" class="cap sub">condenser in heating</text>

      <!-- partition -->
      <line x1="215" y1="30" x2="150" y2="270" class="partition" />

      <!-- outdoor exchanger -->
      <g class="hx">
        <rect x="222" y="160" width="95" height="56" rx="3" />
        @for (k of fins; track k) { <line x1="222" [attr.y1]="167 + k * 6" x2="317" [attr.y2]="167 + k * 6" /> }
      </g>
      <text x="262" y="229" class="cap">outdoor exchanger</text>
      <text x="262" y="241" class="cap sub">evaporator in heating</text>

      <!-- ceramic blocks: 2 rows x 5 (front view) -->
      @for (r of [0, 1]; track r) {
        @for (c of [0, 1, 2, 3, 4]; track c) {
          <rect [attr.x]="98 + c * 44" [attr.y]="274 + r * 52" width="40" height="48" class="block" />
        }
      }
      <text x="196" y="388" class="cap">ceramic regenerator, 2 × 15 blocks</text>

      <!-- fan -->
      <circle cx="196" cy="404" r="11" class="fan" />
      <path d="M196,404 l0,-9 M196,404 l8,5 M196,404 l-8,5" class="fan-blades" />
      <text x="222" y="408" class="lbl">FAN</text>

      <!-- outside duct with filters -->
      <rect x="330" y="44" width="108" height="44" class="duct" />
      <rect x="342" y="50" width="34" height="32" class="filter" />
      <rect x="388" y="50" width="34" height="32" class="filter" />
      <text x="384" y="102" class="cap sub">filters</text>

      <!-- room opening -->
      <rect x="46" y="170" width="14" height="60" class="opening" />

      <!-- air flow at the two openings -->
      @if (phase() === 'supply') {
        <path d="M545,66 L452,66" class="flow s" marker-end="url(#arr-s)" />
        <path d="M46,200 L4,200" class="flow s" marker-end="url(#arr-s)" />
        <text x="494" y="58" class="flowlbl s">fresh air</text>
        <text x="8" y="190" class="flowlbl s">supply</text>
      } @else {
        <path d="M452,66 L545,66" class="flow e" marker-end="url(#arr-e)" />
        <path d="M4,200 L46,200" class="flow e" marker-end="url(#arr-e)" />
        <text x="494" y="58" class="flowlbl e">exhaust</text>
        <text x="8" y="190" class="flowlbl e">room air</text>
      }

      <!-- sensors -->
      @for (s of sensors; track s.id) {
        <g class="sensor" [class.on]="active() === s.id" tabindex="0" role="button" [attr.aria-label]="s.text"
           (mouseenter)="active.set(s.id)" (focus)="active.set(s.id)" (click)="active.set(s.id)">
          <circle [attr.cx]="s.x" [attr.cy]="s.y" r="13" />
          <text [attr.x]="s.x" [attr.y]="s.y + 4">T{{ s.id }}</text>
        </g>
      }
    </svg>
    <p class="explain">
      @if (phase() === 'supply') {
        Supply: outdoor air flows through the ceramic blocks, warmed before by the room air, and enters the room preheated.
        Heat is counted only in this half-cycle: Q = flow · (i₂ − i₃).
      } @else {
        Exhaust: room air leaves through the ceramic blocks and charges them with heat for the next supply half-cycle.
        The compressor keeps running (about 50 % in the measurements).
      }
    </p>
    <p class="sensor-text">{{ activeText() }}</p>
  `,
  styleUrl: './schematic.scss',
})
export class UnitSchematic {
  readonly sensors = SENSORS;
  readonly fins = [0, 1, 2, 3, 4, 5, 6];
  phase = signal<'supply' | 'exhaust'>('supply');
  active = signal(3);
  activeText = computed(() => SENSORS.find(s => s.id === this.active())?.text ?? '');
}
