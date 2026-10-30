import { useSyncExternalStore } from 'react';
import type {
  BackupFile,
  Beneficiary,
  Category,
  DayRecord,
  MonthMeta,
  Settings,
  StockReceipt,
} from '../db/schema';
import type { HolidayCalendar } from '../domain/holidays';
import type { AppData } from '../domain/month';
import { api, reportError } from './http';

let state: AppData | null = null;
const listeners = new Set<() => void>();

export const dataStore = {
  get: () => state,
  set(next: AppData | null) {
    state = next;
    for (const l of listeners) l();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useAppDataStore(): AppData | null {
  return useSyncExternalStore(dataStore.subscribe, dataStore.get);
}

export const loadData = () => api<AppData>('GET', '/api/data');

/** Mutations run one at a time so the server sees every change in the order it was made. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Applies the change locally at once, then saves it. On failure the account is reloaded from
 * the server so the screen never shows unsaved data, and the error is reported to the user.
 */
function mutate(apply: (d: AppData) => AppData, request: () => Promise<unknown>): Promise<boolean> {
  const current = dataStore.get();
  if (!current) return Promise.resolve(false);
  dataStore.set(apply(current));
  const run = queue.then(async () => {
    try {
      await request();
      return true;
    } catch (error) {
      reportError(error);
      try {
        dataStore.set(await loadData());
      } catch {
        // Keep the optimistic state; the unauthorized handler or next action will recover.
      }
      return false;
    }
  });
  queue = run;
  return run;
}

function upsert<T>(list: T[], item: T, same: (a: T) => boolean): T[] {
  return list.some(same) ? list.map((x) => (same(x) ? item : x)) : [...list, item];
}

const enc = encodeURIComponent;

export const dataApi = {
  saveSettings: (patch: Partial<Omit<Settings, 'id'>>) =>
    mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } }), () => api('PATCH', '/api/settings', patch)),

  saveCategory: (c: Category) =>
    mutate(
      (d) => ({ ...d, categories: upsert(d.categories, c, (x) => x.id === c.id).sort((a, b) => a.sortOrder - b.sortOrder) }),
      () => api('PUT', `/api/categories/${enc(c.id)}`, c),
    ),
  deleteCategory: (id: string) =>
    mutate((d) => ({ ...d, categories: d.categories.filter((x) => x.id !== id) }), () => api('DELETE', `/api/categories/${enc(id)}`)),

  saveBeneficiary: (b: Beneficiary) =>
    mutate(
      (d) => ({ ...d, beneficiaries: upsert(d.beneficiaries, b, (x) => x.id === b.id) }),
      () => api('PUT', `/api/beneficiaries/${enc(b.id)}`, b),
    ),
  deleteBeneficiary: (id: string) =>
    mutate((d) => ({ ...d, beneficiaries: d.beneficiaries.filter((x) => x.id !== id) }), () => api('DELETE', `/api/beneficiaries/${enc(id)}`)),

  saveDay: (day: DayRecord) =>
    mutate((d) => ({ ...d, days: upsert(d.days, day, (x) => x.date === day.date) }), () => api('PUT', `/api/days/${day.date}`, day)),

  saveReceipt: (r: StockReceipt) =>
    mutate((d) => ({ ...d, receipts: upsert(d.receipts, r, (x) => x.id === r.id) }), () => api('PUT', `/api/receipts/${enc(r.id)}`, r)),
  deleteReceipt: (id: string) =>
    mutate((d) => ({ ...d, receipts: d.receipts.filter((x) => x.id !== id) }), () => api('DELETE', `/api/receipts/${enc(id)}`)),

  saveMonthMeta: (m: MonthMeta) =>
    mutate((d) => ({ ...d, monthMetas: upsert(d.monthMetas, m, (x) => x.month === m.month) }), () => api('PUT', `/api/month-metas/${m.month}`, m)),

  async importBackup(backup: BackupFile): Promise<void> {
    dataStore.set(await api<AppData>('POST', '/api/import', backup));
  },

  async loadDefaults(): Promise<void> {
    dataStore.set(await api<AppData>('POST', '/api/defaults'));
  },

  async resetAll(): Promise<void> {
    dataStore.set(await api<AppData>('POST', '/api/reset'));
  },

  async refreshHolidays(): Promise<void> {
    const holidayCalendars = await api<HolidayCalendar[]>('POST', '/api/holidays/refresh');
    const current = dataStore.get();
    if (current) dataStore.set({ ...current, holidayCalendars });
  },
};

/** The state holiday calendars are shared data and stay out of backups. */
export function exportBackup({ settings, categories, beneficiaries, days, receipts, monthMetas }: AppData): BackupFile {
  return {
    app: 'icds-report-generator',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    categories,
    beneficiaries,
    days,
    receipts,
    monthMetas,
  };
}

export const newId = () => crypto.randomUUID();
