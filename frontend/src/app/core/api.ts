import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  BlocksResponse, Candidate, CopTPoint, ModbusExchange, ModbusStatus, NtcResponse, RegeneratorRequest,
  RegeneratorResponse, ScanHit, CopParams, Coverage, CumulativeResponse, DatasetInfo, PhasePlan, PhasePreview,
  PhaseSuggestion, WindowResponse,
} from './models';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private base = '/api/v1';

  datasets(): Observable<DatasetInfo[]> {
    return this.http.get<DatasetInfo[]>(`${this.base}/datasets`);
  }

  upload(files: File[]): Observable<DatasetInfo> {
    const form = new FormData();
    for (const f of files) form.append('files', f, f.name);
    return this.http.post<DatasetInfo>(`${this.base}/datasets`, form);
  }

  blocks(id: string, start: string, minutes: number, cop: CopParams): Observable<BlocksResponse> {
    return this.http.post<BlocksResponse>(`${this.base}/datasets/${id}/blocks`, { start, minutes, cop });
  }

  cumulative(id: string, cop: CopParams, maxPoints = 1500): Observable<CumulativeResponse> {
    return this.http.post<CumulativeResponse>(`${this.base}/datasets/${id}/cumulative`, { cop, max_points: maxPoints });
  }

  window(id: string, start: string, minutes: number, cop: CopParams, alignToCycle = false): Observable<WindowResponse> {
    return this.http.post<WindowResponse>(`${this.base}/datasets/${id}/window`, {
      start, minutes, cop, align_to_cycle: alignToCycle,
    });
  }

  phases(id: string): Observable<PhaseSuggestion> {
    return this.http.get<PhaseSuggestion>(`${this.base}/datasets/${id}/phases`);
  }

  phasePreview(id: string, plan: PhasePlan): Observable<PhasePreview> {
    return this.http.post<PhasePreview>(`${this.base}/datasets/${id}/phases/preview`, plan);
  }

  phaseApply(id: string, plan: PhasePlan): Observable<DatasetInfo> {
    return this.http.post<DatasetInfo>(`${this.base}/datasets/${id}/phases/apply`, plan);
  }

  reset(id: string): Observable<DatasetInfo> {
    return this.http.post<DatasetInfo>(`${this.base}/datasets/${id}/reset`, {});
  }

  checkWindows(id: string, windows: { start: string; minutes: number }[], toleranceS = 2): Observable<Coverage[]> {
    return this.http.post<Coverage[]>(`${this.base}/datasets/${id}/windows/check`, { windows, tolerance_s: toleranceS });
  }

  suggestWindows(id: string, minutes = 30, n = 8): Observable<Candidate[]> {
    return this.http.get<Candidate[]>(`${this.base}/datasets/${id}/windows/suggest`, { params: { minutes, n } });
  }

  copVsTout(id: string, cop: CopParams, windows: string[] | null = null): Observable<CopTPoint[]> {
    return this.http.post<CopTPoint[]>(`${this.base}/datasets/${id}/cop-vs-tout`, { cop, windows });
  }

  ntc(body: { table?: [number, number][] | null; resistance?: number | null; current_ma?: number | null; supply_v?: number }): Observable<NtcResponse> {
    return this.http.post<NtcResponse>(`${this.base}/ntc`, body);
  }

  modbusStatus(): Observable<ModbusStatus> {
    return this.http.get<ModbusStatus>(`${this.base}/modbus`);
  }

  modbusRead(unit: number, kind: string, address: number, count: number): Observable<ModbusExchange> {
    return this.http.post<ModbusExchange>(`${this.base}/modbus/read`, { unit, kind, address, count });
  }

  modbusWrite(unit: number, address: number, value: number): Observable<ModbusExchange> {
    return this.http.post<ModbusExchange>(`${this.base}/modbus/write`, { unit, address, value });
  }

  modbusScan(unitFrom: number, unitTo: number, address: number): Observable<ScanHit[]> {
    return this.http.post<ScanHit[]>(`${this.base}/modbus/scan`, { unit_from: unitFrom, unit_to: unitTo, address });
  }

  regenerator(req: RegeneratorRequest): Observable<RegeneratorResponse> {
    return this.http.post<RegeneratorResponse>(`${this.base}/regenerator`, req);
  }
}
