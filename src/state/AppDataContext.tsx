import { createContext, useContext, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Language } from '../db/schema';
import type { AppData } from '../domain/month';
import strings, { type StringKey } from '../i18n/strings';

interface AppState {
  data: AppData;
  lang: Language;
  t: (key: StringKey) => string;
}

const Ctx = createContext<AppState | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const data = useLiveQuery(async (): Promise<AppData | null> => {
    const [settings, categories, beneficiaries, days, receipts, monthMetas] = await Promise.all([
      db.settings.get('settings'),
      db.categories.orderBy('sortOrder').toArray(),
      db.beneficiaries.toArray(),
      db.days.toArray(),
      db.receipts.toArray(),
      db.monthMetas.toArray(),
    ]);
    if (!settings) return null;
    return { settings, categories, beneficiaries, days, receipts, monthMetas };
  });

  if (!data) {
    return (
      <div className="flex h-dvh items-center justify-center text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }
  const lang = data.settings.language;
  const t = (key: StringKey) => strings[key][lang];
  return <Ctx.Provider value={{ data, lang, t }}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppDataProvider');
  return ctx;
}
