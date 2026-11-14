import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { Api } from '../../core/api';
import { errorMessage, eventText, eventValue } from '../../core/format';
import { ModbusExchange, ModbusStatus, ScanHit } from '../../core/models';
import { ToolHead } from '../../shared/tool-head';
import { FrameView } from './frame-view';

@Component({
  selector: 'app-modbus',
  imports: [ToolHead, FrameView],
  templateUrl: './modbus.html',
  styleUrl: './modbus.scss',
})
export class ModbusPage {
  private api = inject(Api);
  readonly value = eventValue;
  readonly text = eventText;

  status = toSignal(this.api.modbusStatus().pipe(catchError(() => of(null as ModbusStatus | null))));

  // scan (szukanie_modnusa.py)
  scanFrom = signal(1);
  scanTo = signal(31);
  scanAddress = signal(3130);
  scanning = signal(false);
  hits = signal<ScanHit[] | null>(null);

  // read / write (Zmiana_rejestrow.py)
  unit = signal(1);
  kind = signal<'input' | 'holding'>('input');
  address = signal(4036);
  count = signal(1);
  readResult = signal<ModbusExchange | null>(null);

  writeAddress = signal(4004);
  writeValue = signal(2);
  confirm = signal(false);
  writeResult = signal<ModbusExchange | null>(null);

  error = signal<string | null>(null);

  scan(): void {
    this.scanning.set(true);
    this.hits.set(null);
    this.api.modbusScan(this.scanFrom(), this.scanTo(), this.scanAddress()).subscribe({
      next: h => {
        this.hits.set(h);
        this.scanning.set(false);
        if (h.length) this.unit.set(h[0].unit);
      },
      error: err => {
        this.scanning.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  read(): void {
    this.api.modbusRead(this.unit(), this.kind(), this.address(), this.count()).subscribe({
      next: r => this.readResult.set(r),
      error: err => this.error.set(errorMessage(err)),
    });
  }

  write(): void {
    if (!this.confirm()) return;
    this.api.modbusWrite(this.unit(), this.writeAddress(), this.writeValue()).subscribe({
      next: r => {
        this.writeResult.set(r);
        this.confirm.set(false);
      },
      error: err => this.error.set(errorMessage(err)),
    });
  }
}
