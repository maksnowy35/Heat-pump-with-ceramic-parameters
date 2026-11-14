import { Component, computed, input, signal } from '@angular/core';

import { tool } from '../core/tools';

/** Title of a tool with its info button; the panel explains the tool and names the scripts it replaces. */
@Component({
  selector: 'app-tool-head',
  template: `
    @let t = info();
    <header class="head" [class.sub]="level() === 2">
      <div class="title">
        @if (level() === 1) { <h1>{{ t.title }}</h1> } @else { <h2>{{ t.title }}</h2> }
        <button type="button" class="info" [class.on]="open()" [attr.aria-expanded]="open()"
                [attr.aria-controls]="'info-' + t.id" (click)="open.set(!open())"
                [attr.aria-label]="'About ' + t.title" title="What this tool does">i</button>
      </div>
      <p class="lead">{{ t.lead }}</p>
    </header>
    @if (open()) {
      <section class="panel" [id]="'info-' + t.id" role="region" [attr.aria-label]="'About ' + t.title">
        <p>{{ t.what }}</p>
        <h3>How it works</h3>
        <ul>
          @for (s of t.how; track $index) { <li>{{ s }}</li> }
        </ul>
        @if (t.formulas?.length) {
          <h3>Formulas</h3>
          @for (f of t.formulas; track $index) { <code class="f">{{ f }}</code> }
        }
        @if (t.note) { <p class="note-box">{{ t.note }}</p> }
        <p class="replaces">
          Replaces
          @for (s of t.scripts; track s) { <code>{{ s }}</code> }
        </p>
      </section>
    }
  `,
  styles: `
    .head { margin-bottom: 1rem; }
    .head.sub { margin: 0 0 0.6rem; }
    .title { display: flex; align-items: center; gap: 0.6rem; }
    h1 { font-size: clamp(1.5rem, 2.4vw, 2rem); font-weight: 600; margin: 0; }
    h2 { margin: 0; font-size: 1.3rem; }
    .lead { margin: 0.2rem 0 0; color: var(--steel); max-width: 75ch; }
    .info { width: 1.6rem; height: 1.6rem; padding: 0; border-radius: 50%; font-family: Georgia, serif;
            font-style: italic; font-weight: 700; font-size: 0.95rem; line-height: 1; flex: none; }
    .info.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
    .panel { background: var(--panel); border: 1px solid var(--rule); border-left: 3px solid var(--ochre);
             border-radius: var(--radius); padding: 0.9rem 1.1rem; margin: 0 0 1.4rem; max-width: 980px; font-size: 0.93rem; }
    .panel p { margin: 0 0 0.6rem; max-width: 85ch; }
    .panel h3 { font-size: 0.95rem; margin: 0.8rem 0 0.3rem; }
    .panel ul { margin: 0; padding-left: 1.2rem; }
    .panel li { margin-bottom: 0.25rem; max-width: 85ch; }
    .f { display: block; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.86rem; padding: 0.15rem 0; }
    .note-box { margin-top: 0.8rem !important; padding: 0.5rem 0.7rem; background: #f6efdc; border-radius: var(--radius); }
    .replaces { margin: 0.8rem 0 0 !important; color: var(--steel); font-size: 0.85rem; }
    .replaces code { font-size: 0.82rem; background: var(--paper); border: 1px solid var(--rule); border-radius: 3px;
                     padding: 0.05rem 0.35rem; margin-left: 0.35rem; color: var(--ink); white-space: nowrap; }
  `,
})
export class ToolHead {
  id = input.required<string>();
  level = input<1 | 2>(1);
  open = signal(false);
  info = computed(() => tool(this.id()));
}
