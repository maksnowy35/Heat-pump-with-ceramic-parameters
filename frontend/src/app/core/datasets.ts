import { Injectable, computed, inject, signal } from '@angular/core';

import { Api } from './api';
import { errorMessage } from './format';
import { DatasetInfo } from './models';

/** The record every tool works on: the synthetic demo or a report uploaded in this session. */
@Injectable({ providedIn: 'root' })
export class Datasets {
  private api = inject(Api);

  readonly list = signal<DatasetInfo[]>([]);
  readonly selectedId = signal('demo');
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly loaded = signal(false);

  readonly selected = computed(() => this.list().find(d => d.id === this.selectedId()) ?? null);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.api.datasets().subscribe({
      next: items => {
        this.list.set(items);
        this.loaded.set(true);
        this.error.set(null);
      },
      error: err => this.error.set(errorMessage(err)),
    });
  }

  upload(files: File[]): void {
    if (!files.length) return;
    this.uploading.set(true);
    this.api.upload(files).subscribe({
      next: info => {
        this.list.update(l => [...l.filter(d => d.id !== info.id), info]);
        this.selectedId.set(info.id);
        this.uploading.set(false);
        this.error.set(null);
      },
      error: err => {
        this.uploading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  /** replace the summary after a tool changed the record (e.g. reconstructed flags) */
  update(info: DatasetInfo): void {
    this.list.update(l => l.map(d => (d.id === info.id ? info : d)));
  }
}
