import Dexie, { type EntityTable } from 'dexie';
import type { BackupFile, Beneficiary, Category, DayRecord, MonthMeta, Settings, StockReceipt } from './schema';
import { defaultCategories, defaultSettings } from './defaults';

class IcdsDb extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  beneficiaries!: EntityTable<Beneficiary, 'id'>;
  days!: EntityTable<DayRecord, 'date'>;
  receipts!: EntityTable<StockReceipt, 'id'>;
  monthMetas!: EntityTable<MonthMeta, 'month'>;

  constructor() {
    super('icds-report-generator');
    this.version(1).stores({
      settings: 'id',
      categories: 'id, sortOrder',
      beneficiaries: 'id, kind, name',
      days: 'date',
      receipts: 'id, date',
      monthMetas: 'month',
    });
    this.on('populate', async (tx) => {
      await tx.table('settings').add(defaultSettings());
      await tx.table('categories').bulkAdd(defaultCategories());
    });
  }
}

export const db = new IcdsDb();

export function newId(): string {
  return crypto.randomUUID();
}

export async function exportBackup(): Promise<BackupFile> {
  const [settings, categories, beneficiaries, days, receipts, monthMetas] = await Promise.all([
    db.settings.get('settings'),
    db.categories.toArray(),
    db.beneficiaries.toArray(),
    db.days.toArray(),
    db.receipts.toArray(),
    db.monthMetas.toArray(),
  ]);
  return {
    app: 'icds-report-generator',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settings ?? defaultSettings(),
    categories,
    beneficiaries,
    days,
    receipts,
    monthMetas,
  };
}

export async function importBackup(data: BackupFile): Promise<void> {
  if (data.app !== 'icds-report-generator' || data.version !== 1) {
    throw new Error('Not an ICDS Report Generator backup file');
  }
  await db.transaction('rw', [db.settings, db.categories, db.beneficiaries, db.days, db.receipts, db.monthMetas], async () => {
    await Promise.all([
      db.settings.clear(), db.categories.clear(), db.beneficiaries.clear(),
      db.days.clear(), db.receipts.clear(), db.monthMetas.clear(),
    ]);
    await db.settings.put({ ...defaultSettings(), ...data.settings, id: 'settings' });
    await db.categories.bulkPut(data.categories);
    await db.beneficiaries.bulkPut(data.beneficiaries);
    await db.days.bulkPut(data.days);
    await db.receipts.bulkPut(data.receipts);
    await db.monthMetas.bulkPut(data.monthMetas);
  });
}
