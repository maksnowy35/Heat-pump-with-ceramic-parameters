import { Component } from '@angular/core';

/** One 120 s cycle: air flow through the regenerator, logger flags and what the COP counts (after Fig. 6 of the paper). */
@Component({
  selector: 'app-cycle-timeline',
  template: `
    <svg viewBox="0 0 640 300" role="img" aria-label="One cycle: air flow, flags and the energy counted">
      <g transform="translate(110,20)">
        <!-- time axis -->
        @for (t of ticks; track t) {
          <line [attr.x1]="x(t)" y1="0" [attr.x2]="x(t)" y2="250" class="grid" />
          <text [attr.x]="x(t)" y="268" class="tick">{{ t }} s</text>
        }
        <!-- mass flow: supply positive, exhaust negative, 2 s dwell at each reversal -->
        <line x1="0" y1="60" [attr.x2]="x(120)" y2="60" class="axis" />
        <path [attr.d]="flowPath" class="flow" />
        <text [attr.x]="x(30)" y="12" class="lbl s">supply, outside → room</text>
        <text [attr.x]="x(90)" y="118" class="lbl e">exhaust, room → outside</text>
        <text [attr.x]="x(60)" y="80" class="lbl small">vane turns</text>

        <!-- logger flags -->
        <rect x="0" y="140" [attr.width]="x(60)" height="18" class="flag s" />
        <rect [attr.x]="x(60)" y="164" [attr.width]="x(60)" height="18" class="flag e" />
        <!-- what is counted -->
        <rect x="0" y="196" [attr.width]="x(60)" height="18" class="count q" />
        <text [attr.x]="x(30)" y="209" class="in">Q = flow · (i₂ − i₃) · Δt</text>
        <rect x="0" y="222" [attr.width]="x(120)" height="18" class="count w" />
        <text [attr.x]="x(60)" y="235" class="in">W = (P_comp + 0.45 kW) · Δt</text>
      </g>
      <text x="100" y="84" class="side">air flow ṁ</text>
      <text x="100" y="173" class="side">nawiew = 1</text>
      <text x="100" y="197" class="side">wywiew = 1</text>
      <text x="100" y="229" class="side">heat</text>
      <text x="100" y="255" class="side">electrical energy</text>
    </svg>
  `,
  styleUrl: './schematic.scss',
})
export class CycleTimeline {
  readonly ticks = [0, 20, 40, 60, 80, 100, 120];
  readonly w = 500;
  x(t: number): number {
    return (t / 120) * this.w;
  }
  get flowPath(): string {
    const x = (t: number) => this.x(t);
    return `M0,60 L${x(2)},24 L${x(58)},24 L${x(62)},96 L${x(118)},96 L${x(120)},60`;
  }
}
