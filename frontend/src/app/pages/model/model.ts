import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface AuditItem {
  topic: string;
  scripts: string;
  why: string;
  now: string;
  effect: string;
  mode: boolean;
  link?: { route: string; label: string };
}

const AUDIT: AuditItem[] = [
  {
    topic: 'Air flow in the heat balance',
    scripts: 'Q = 0.389 · Δi in every COP script.',
    why: '0.389 is the volume flow, 1400 m³/h in m³/s. Δi is per kilogram of dry air, so the balance needs the mass flow; the thesis gives ṁ = 0.468 kg/s (ρ = 1.2 kg/m³, V̇ = 1400 m³/h).',
    now: 'Corrected mode uses 0.468 kg/s.',
    effect: 'Q and every COP 1.20 × higher; the ratio between windows and the trend with T3 stay the same.',
    mode: true,
  },
  {
    topic: 'Constant power in the running COP',
    scripts: 'nowy_skumulowane4.py and skumulowany_5najnowszy.py add 0.45 kW on exhaust rows only; the block scripts add it on every row.',
    why: 'The fan and automation run all the time, so over the record only half of their energy was counted.',
    now: 'Corrected mode counts it on every row, as the block scripts did.',
    effect: 'The whole-record COP "with the constant power" (Wykres 3 of the thesis) comes out lower, consistent with the block COP.',
    mode: true,
  },
  {
    topic: 'Time step after a logging gap',
    scripts: 'Δt of a row = time since the previous row.',
    why: 'The first row after a gap (a weekend break, a logger restart) carries the whole gap: one sample adds hours of heat or energy, depending on its half-cycle.',
    now: 'Corrected mode caps Δt at 10 s (five samples).',
    effect: 'No jump in the running COP after a gap. Window and block results are not affected unless a gap falls inside them.',
    mode: true,
    link: { route: '/overview', label: 'Whole record' },
  },
  {
    topic: 'Block boundaries',
    scripts: 'Clock-aligned 2-minute bins (pandas resample "2min").',
    why: 'With exact 60 + 60 s half-cycles any 120 s bin holds one supply and one exhaust half-cycle, but small timing drifts move samples between bins.',
    now: 'Corrected mode makes one block per cycle, from the start of its supply half-cycle.',
    effect: 'Small; the blocks are true cycles and the block COP is the cycle COP.',
    mode: true,
  },
  {
    topic: 'Rebuilt supply/exhaust flags',
    scripts: 'uzupelnienie_nawiew_wywiew.py switched the flags when a row was more than one half-cycle before the last switch, then restarted the count at that row.',
    why: 'The count restarts one sample late every time, so each rebuilt half-cycle is one sample too long and the phase drifts going back in time.',
    now: 'Fixed in both modes: every switch exactly one half-cycle apart, anchored at a logged switch (tested).',
    effect: 'Correct flags over the whole rebuilt part instead of a drifting phase.',
    mode: false,
    link: { route: '/record', label: 'Flags tool' },
  },
  {
    topic: 'NTC table interpolation',
    scripts: 'NTC5k_characterisitc.py interpolates linearly in R between table points 10 K apart.',
    why: 'R falls exponentially with temperature; a straight line in R lies above the curve between the points.',
    now: 'The NTC tool shows the linear result next to interpolation in ln R against 1/T and fitted Beta and Steinhart–Hart curves.',
    effect: 'Linear interpolation reads 0.4–0.7 K warm mid-interval, more than the ±0.425 K class B tolerance.',
    mode: false,
    link: { route: '/ntc', label: 'NTC tool' },
  },
  {
    topic: 'Time constant of the regenerator',
    scripts: 'Section 4.4: τ = C / (hA) ≈ 12.5 s, so a 60 s half-cycle is 4.8 τ and the bed is nearly saturated; 40–50 s half-cycles are recommended.',
    why: 'C / (hA) is how fast the channel walls follow the air at a fixed air temperature. With NTU ≈ 16 the air leaves the bed at nearly the ceramic temperature, so how fast the bed charges is limited by the heat the air can carry, ṁ·c_p, not by hA. That time scale is C / (ṁ·c_p) ≈ 200 s; in 60 s the air carries about 0.3 of what the bed holds per kelvin.',
    now: 'The regenerator tool shows both time scales.',
    effect: 'A bed far from saturated in 60 s fits the > 90 % effectiveness and the 240 s optimum cycle reported in the paper. Shorter half-cycles should be decided by measurement, not by τ = 12.5 s.',
    mode: false,
    link: { route: '/regenerator', label: 'Regenerator tool' },
  },
];

@Component({
  selector: 'app-model',
  imports: [RouterLink],
  templateUrl: './model.html',
  styleUrl: './model.scss',
})
export class ModelPage {
  readonly audit = AUDIT;
}
