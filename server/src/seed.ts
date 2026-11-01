import type { ObjectId } from 'mongodb';
import { defaultCategories, defaultSettings } from '../../src/db/defaults';
import type { CenterInfo, Settings } from '../../src/db/schema';
import type { Collections } from './db';

/** Default injection for a new or reset account: shared norms, rates and categories; the centre is the user's own. */
export async function seedUser(
  c: Collections,
  userId: ObjectId,
  center: Partial<CenterInfo>,
  keep: Partial<Pick<Settings, 'language' | 'paperSize' | 'snpInPaise'>> = {},
): Promise<void> {
  const { id: _id, ...settings } = { ...defaultSettings(center), ...keep };
  await c.settings.replaceOne({ userId }, { ...settings, userId }, { upsert: true });
  await c.categories.insertMany(defaultCategories().map((cat) => ({ ...cat, userId })));
}

/** Gives every account the defaults for settings it does not have yet; values a user has set are kept. */
export async function backfillDefaultSettings(c: Collections): Promise<void> {
  const { fuelPerCookingDay } = defaultSettings();
  await c.settings.updateMany({ fuelPerCookingDay: { $exists: false } }, { $set: { fuelPerCookingDay } });
  // Turmeric is a spice paid from the daily fuel amount, no longer a stock item.
  const turmericNorms = ['norms.khichuri.turmeric', 'norms.rice.turmeric'];
  await c.categories.updateMany(
    { $or: turmericNorms.map((field) => ({ [field]: { $exists: true } })) },
    { $unset: Object.fromEntries(turmericNorms.map((field) => [field, ''])) } as never,
  );
  await c.monthMetas.updateMany({ 'openingStock.turmeric': { $exists: true } }, { $unset: { 'openingStock.turmeric': '' } });
  await c.receipts.deleteMany({ item: 'turmeric' as never });
}

/**
 * Puts the shared setup (rates, categories and norms, daily fuel amount, nursing period,
 * weekly off, state holiday mode) back to the defaults. Beneficiaries, attendance, stock, month overrides,
 * the centre's own holidays and saved reports are untouched.
 */
export async function restoreDefaultSetup(c: Collections, userId: ObjectId): Promise<void> {
  const { rates, rateGrams, nursingMonths, weeklyOffDays, fuelPerCookingDay } = defaultSettings();
  await c.settings.updateOne(
    { userId },
    { $set: { rates, rateGrams, nursingMonths, weeklyOffDays, fuelPerCookingDay, stateHolidays: 'all' }, $unset: { fuelItems: '' } },
  );
  await c.categories.deleteMany({ userId });
  await c.categories.insertMany(defaultCategories().map((cat) => ({ ...cat, userId })));
}
