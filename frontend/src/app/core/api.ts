import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BlocksResponse, CopParams, CumulativeResponse, DatasetInfo } from './models';

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
}
