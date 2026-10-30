import { z } from 'zod';
import {
  STATE_HOLIDAY_MODES,
  type BackupFile,
  type Beneficiary,
  type Category,
  type CenterInfo,
  type DayRecord,
  type MonthMeta,
  type Settings,
  type StockReceipt,
} from '../../src/db/schema';

/** Every object is strict: unknown keys (including Mongo operators such as `$set`) are rejected. */

export const idSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
/** YYYY-MM-DD that exists on the calendar (rejects 2026-09-31, 2026-02-29 …). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, 'Not a real calendar date');
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const text = (max: number) => z.string().max(max);
const amount = z.number().finite().min(0).max(1e9);
const timestamp = z.number().int().min(0).max(1e14);

const items = z.strictObject({
  rice: amount,
  dal: amount,
  oil: amount,
  salt: amount,
  egg: amount,
  veg: amount,
  potato: amount,
  chatu: amount,
});

export const categorySchema = z.strictObject({
  id: idSchema,
  name: text(100).min(1),
  group: z.enum(['mother', 'child']),
  motherStage: z.enum(['pregnant', 'nursing']).optional(),
  minMonths: z.number().int().min(0).max(1200).optional(),
  maxMonths: z.number().int().min(0).max(1200).optional(),
  servesMeal: z.boolean(),
  sortOrder: z.number().int().min(0).max(100_000),
  norms: z.strictObject({ khichuri: items, rice: items }),
}) satisfies z.ZodType<Category>;

const beneficiaryBase = {
  id: idSchema,
  name: text(120).min(1),
  enrolledOn: isoDateSchema,
  exitedOn: isoDateSchema.optional(),
  notes: text(500).optional(),
};

export const beneficiarySchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...beneficiaryBase,
    kind: z.literal('child'),
    gender: z.enum(['M', 'F']),
    dob: isoDateSchema.optional(),
    guardianName: text(120).optional(),
  }),
  z.strictObject({
    ...beneficiaryBase,
    kind: z.literal('mother'),
    husbandName: text(120).optional(),
    expectedDeliveryDate: isoDateSchema.optional(),
    deliveryDate: isoDateSchema.optional(),
  }),
]) satisfies z.ZodType<Beneficiary>;

export const daySchema = z.strictObject({
  date: isoDateSchema,
  status: z.enum(['working', 'holiday']),
  holidayReason: text(120).optional(),
  meal: z.enum(['khichuri', 'rice']),
  presentIds: z.array(idSchema).max(2000),
  updatedAt: timestamp,
  submittedAt: timestamp.optional(),
}) satisfies z.ZodType<DayRecord>;

export const receiptSchema = z.strictObject({
  id: idSchema,
  date: isoDateSchema,
  item: z.enum(['chatu', 'rice', 'dal', 'oil', 'salt']),
  quantity: amount,
  challanNo: text(50).optional(),
  note: text(300).optional(),
}) satisfies z.ZodType<StockReceipt>;

export const monthMetaSchema = z.strictObject({
  month: monthSchema,
  openingStock: z
    .strictObject({
      chatu: amount.optional(),
      rice: amount.optional(),
      dal: amount.optional(),
      oil: amount.optional(),
      salt: amount.optional(),
    })
    .optional(),
  fuelOverrides: z
    .array(z.strictObject({ fuelItemId: idSchema, quantity: amount.optional(), rate: amount.optional() }))
    .max(50)
    .optional(),
}) satisfies z.ZodType<MonthMeta>;

export const centerSchema = z.strictObject({
  name: text(150),
  number: text(30),
  code: text(30),
  gramPanchayat: text(150),
  project: text(150),
  district: text(150),
  workerName: text(150),
  vegShopkeeper: text(150),
  fuelShopkeeper: text(150),
}) satisfies z.ZodType<CenterInfo>;

const settingsFields = {
  language: z.enum(['bn', 'en']),
  center: centerSchema,
  rates: z.strictObject({ egg: amount, veg: amount, potato: amount, chatu: amount }),
  nursingMonths: z.number().int().min(1).max(36),
  weeklyOffDays: z.array(z.number().int().min(0).max(6)).max(7),
  fuelItems: z
    .array(
      z.strictObject({
        id: idSchema,
        name: text(150).min(1),
        unit: text(20),
        rate: amount,
        qtyPerBeneficiaryDay: amount,
      }),
    )
    .max(50),
  holidays: z.array(z.strictObject({ date: isoDateSchema, name: text(120).min(1) })).max(400),
  stateHolidays: z.enum(STATE_HOLIDAY_MODES).optional(),
  openOnStateHolidays: z.array(isoDateSchema).max(2000).optional(),
  paperSize: z.enum(['A4', 'A3']).optional(),
};

export const settingsSchema = z.strictObject({
  id: z.literal('settings'),
  ...settingsFields,
}) satisfies z.ZodType<Settings>;

export const settingsPatchSchema = z.strictObject(settingsFields).partial();

export const backupSchema = z.strictObject({
  app: z.literal('icds-report-generator'),
  version: z.literal(1),
  exportedAt: z.string().max(40),
  settings: settingsSchema,
  categories: z.array(categorySchema).max(100),
  beneficiaries: z.array(beneficiarySchema).max(10_000),
  days: z.array(daySchema).max(10_000),
  receipts: z.array(receiptSchema).max(10_000),
  monthMetas: z.array(monthMetaSchema).max(1_000),
}) satisfies z.ZodType<BackupFile>;

const loginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._@+-]{3,100}$/, 'Use an email address or mobile number');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(200);

export const registerSchema = z.strictObject({
  login: loginSchema,
  password: passwordSchema,
  name: text(150).trim().min(1),
  center: centerSchema.partial().extend({ name: text(150).trim().min(1), number: text(30).trim().min(1) }),
  language: z.enum(['bn', 'en']).optional(),
});

export const loginRequestSchema = z.strictObject({ login: loginSchema, password: z.string().min(1).max(200) });

export const passwordChangeSchema = z.strictObject({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});
