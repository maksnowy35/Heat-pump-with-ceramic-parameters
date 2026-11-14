import { Component, input } from '@angular/core';

import { ModbusExchange } from '../../core/models';

/** Request and response of one exchange, byte by byte. */
@Component({
  selector: 'app-frame-view',
  template: `
    @let x = exchange();
    <div class="result" [class.bad]="!x.ok">
      @if (x.ok) {
        <p class="values">
          @for (v of x.values; track $index) { <b>{{ v }}</b> <small>0x{{ v.toString(16).toUpperCase().padStart(4, '0') }}</small> }
        </p>
      } @else {
        <p class="values"><b>{{ x.error }}</b></p>
      }
      <div class="frames">
        <div>
          <span class="dir">→ request</span>
          <div class="bytes">
            @for (f of x.request_fields; track $index) { <span [title]="f.field"><code>{{ f.hex }}</code><small>{{ f.field }}</small></span> }
          </div>
        </div>
        @if (x.response_fields.length) {
          <div>
            <span class="dir">← response</span>
            <div class="bytes">
              @for (f of x.response_fields; track $index) { <span [title]="f.field"><code>{{ f.hex }}</code><small>{{ f.field }}</small></span> }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .result { border-left: 3px solid var(--frost); padding: 0.4rem 0 0.4rem 0.8rem; margin-top: 0.8rem; }
    .result.bad { border-left-color: var(--signal); }
    .values { margin: 0 0 0.5rem; font-variant-numeric: tabular-nums; }
    .values b { font-size: 1.15rem; font-weight: 600; margin-right: 0.2rem; }
    .values small { color: var(--steel); margin-right: 1rem; }
    .dir { font-size: 0.8rem; color: var(--steel); }
    .bytes { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0.15rem 0 0.5rem; }
    .bytes span { display: flex; flex-direction: column; align-items: center; background: var(--panel);
                  border: 1px solid var(--rule); border-radius: 3px; padding: 0.15rem 0.4rem; }
    .bytes code { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.92rem; font-weight: 600; }
    .bytes small { font-size: 0.68rem; color: var(--steel); white-space: nowrap; }
  `,
})
export class FrameView {
  exchange = input.required<ModbusExchange>();
}
