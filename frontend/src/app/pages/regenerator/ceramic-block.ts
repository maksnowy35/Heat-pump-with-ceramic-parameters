import { Component, computed, input } from '@angular/core';

/** Face of one honeycomb block with a zoomed corner showing pitch, wall and channel. */
@Component({
  selector: 'app-ceramic-block',
  template: `
    <svg viewBox="0 0 480 240" role="img" [attr.aria-label]="'Block face, ' + cells() + ' by ' + cells() + ' channels'">
      <g transform="translate(10,10)">
        <rect width="200" height="200" class="frame" />
        @for (i of grid(); track i) {
          <line [attr.x1]="i" y1="0" [attr.x2]="i" y2="200" class="wall" />
          <line x1="0" [attr.y1]="i" x2="200" [attr.y2]="i" class="wall" />
        }
        <rect x="0" y="0" width="40" height="40" class="zoombox" />
        <text x="100" y="222" class="cap">{{ cells() }} × {{ cells() }} channels, 150 mm</text>
      </g>
      <g transform="translate(240,10)">
        <rect width="160" height="160" class="cell-bg" />
        @for (k of [0, 1, 2]; track k) {
          @for (m of [0, 1, 2]; track m) {
            <rect [attr.x]="wallPx() / 2 + k * pitchPx()" [attr.y]="wallPx() / 2 + m * pitchPx()"
                  [attr.width]="pitchPx() - wallPx()" [attr.height]="pitchPx() - wallPx()" class="channel" />
          }
        }
        <line [attr.x1]="wallPx() / 2" y1="172" [attr.x2]="wallPx() / 2 + pitchPx()" y2="172" class="dim" />
        <text [attr.x]="wallPx() / 2 + pitchPx() / 2" y="188" class="lbl">p = {{ pitch().toFixed(3) }} mm</text>
        <text x="168" [attr.y]="wallPx() / 2 + (pitchPx() - wallPx()) / 2 + 4" class="lbl l">a = {{ channel().toFixed(3) }} mm</text>
        <text x="168" [attr.y]="wallPx() / 2 + pitchPx() - wallPx() / 2 + 4" class="lbl l">t = {{ wall().toFixed(3) }} mm</text>
      </g>
    </svg>
  `,
  styles: `
    svg { width: 100%; max-width: 460px; display: block; }
    .frame { fill: #e7dcc9; stroke: var(--ink); stroke-width: 1.5; }
    .wall { stroke: #b9a582; stroke-width: 0.6; }
    .zoombox { fill: none; stroke: var(--signal); stroke-width: 1.5; }
    .cell-bg { fill: #c9b48f; stroke: var(--signal); stroke-width: 1.5; }
    .channel { fill: var(--paper); }
    .dim { stroke: var(--ink); stroke-width: 1; }
    .lbl { font: 12px 'Barlow', sans-serif; fill: var(--ink); text-anchor: middle; }
    .lbl.l { text-anchor: start; }
    .cap { font: 12px 'Barlow', sans-serif; fill: var(--steel); text-anchor: middle; }
  `,
})
export class CeramicBlock {
  cells = input(60);
  pitch = input(2.493);     // mm
  wall = input(0.277);      // mm
  channel = input(2.216);   // mm

  grid = computed(() => {
    const n = Math.min(this.cells(), 30);
    return Array.from({ length: n - 1 }, (_, i) => ((i + 1) * 200) / n);
  });
  pitchPx = computed(() => 150 / 3);
  wallPx = computed(() => Math.max(2, (this.wall() / this.pitch()) * this.pitchPx()));
}
