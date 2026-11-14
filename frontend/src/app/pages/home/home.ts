import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TOOLS, ToolInfo } from '../../core/tools';

const GROUPS: { id: ToolInfo['group']; title: string; text: string }[] = [
  { id: 'data', title: 'Data', text: 'Load the logger reports, repair them and pick the windows to analyse.' },
  { id: 'analysis', title: 'Analysis', text: 'From the whole campaign down to a single 120-second cycle.' },
  { id: 'lab', title: 'Lab tools', text: 'Sensors, the controller bus and the ceramic regenerator.' },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  readonly groups = GROUPS.map(g => ({ ...g, tools: TOOLS.filter(t => t.group === g.id) }));
}
