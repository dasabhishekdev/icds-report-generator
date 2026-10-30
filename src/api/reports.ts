import type { PaperSize } from '../db/schema';
import type { ReportId } from '../reports';
import { api } from './http';

export type ReportFileKind = 'pdf' | 'xlsx';

export interface StoredReport {
  id: string;
  month: string;
  from: string;
  to: string;
  sheets: ReportId[];
  paper: PaperSize;
  createdAt: string;
  storage: 's3' | 'disk';
  files: { kind: ReportFileKind; name: string; size: number }[];
  summary: { servedDays: number; beneficiaryDays: number; purchaseTotal: number; fuelTotal: number };
}

export interface GenerateRequest {
  from: string;
  to: string;
  paper: PaperSize;
  /** Omit for all four registers. */
  sheets?: ReportId[];
}

export const reportsApi = {
  list: (month?: string) => api<StoredReport[]>('GET', `/api/reports${month ? `?month=${month}` : ''}`),
  generate: (req: GenerateRequest) => api<StoredReport>('POST', '/api/reports', req),
  remove: (id: string) => api<void>('DELETE', `/api/reports/${id}`),
  fileUrl: (id: string, kind: ReportFileKind, inline = false) => `/api/reports/${id}/files/${kind}${inline ? '?inline=1' : ''}`,
};

/** Starts a download of an already generated file (same-origin, so the session cookie is sent). */
export function downloadReportFile(id: string, kind: ReportFileKind) {
  const a = document.createElement('a');
  a.href = reportsApi.fileUrl(id, kind);
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
