import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ObjectId } from 'mongodb';
import type { Settings } from '../../src/db/schema';
import type { AppData } from '../../src/domain/month';
import type { Collections } from './db';
import type { HolidayService } from './holidays/service';
import {
  backupSchema,
  beneficiarySchema,
  categorySchema,
  daySchema,
  idSchema,
  isoDateSchema,
  monthMetaSchema,
  monthSchema,
  receiptSchema,
  settingsPatchSchema,
} from './schemas';
import { restoreDefaultSetup, seedUser } from './seed';

const HIDDEN = { projection: { _id: 0, userId: 0 } } as const;
const BUILT_IN_CATEGORIES = new Set(['pregnant', 'nursing']);

function uid(request: FastifyRequest): ObjectId {
  if (!request.userId) throw new Error('requireUser did not run');
  return request.userId;
}

function param(request: FastifyRequest, name: string): string {
  return (request.params as Record<string, string>)[name];
}

/** Last, this and next year, every year with attendance, and the years of `extraDates`. */
function calendarYears(days: readonly { date: string }[], extraDates: readonly string[]): number[] {
  const current = new Date().getFullYear();
  const years = new Set([current - 1, current, current + 1]);
  for (const d of [...days.map((x) => x.date), ...extraDates]) years.add(Number(d.slice(0, 4)));
  return [...years].sort((a, b) => a - b);
}

export async function loadUserData(
  c: Collections,
  holidays: HolidayService,
  userId: ObjectId,
  extraDates: readonly string[] = [],
): Promise<AppData> {
  const [settings, categories, beneficiaries, days, receipts, monthMetas] = await Promise.all([
    c.settings.findOne({ userId }, HIDDEN),
    c.categories.find({ userId }, HIDDEN).sort({ sortOrder: 1 }).toArray(),
    c.beneficiaries.find({ userId }, HIDDEN).toArray(),
    c.days.find({ userId }, HIDDEN).sort({ date: 1 }).toArray(),
    c.receipts.find({ userId }, HIDDEN).sort({ date: 1 }).toArray(),
    c.monthMetas.find({ userId }, HIDDEN).toArray(),
  ]);
  if (!settings) throw new Error('Account has no settings');
  const holidayCalendars = await holidays.calendars(calendarYears(days, extraDates));
  return { settings: { ...settings, id: 'settings' } as Settings, categories, beneficiaries, days, receipts, monthMetas, holidayCalendars };
}

async function wipe(c: Collections, userId: ObjectId) {
  await Promise.all([
    c.settings.deleteMany({ userId }),
    c.categories.deleteMany({ userId }),
    c.beneficiaries.deleteMany({ userId }),
    c.days.deleteMany({ userId }),
    c.receipts.deleteMany({ userId }),
    c.monthMetas.deleteMany({ userId }),
  ]);
}

export function registerDataRoutes(app: FastifyInstance, c: Collections, holidays: HolidayService) {
  const auth = { preHandler: app.requireUser };

  app.get('/api/data', auth, async (request) => loadUserData(c, holidays, uid(request)));

  /** Re-downloads this and next year's state holiday list now; answers with the account's calendars. */
  app.post(
    '/api/holidays/refresh',
    { ...auth, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request) => {
      const year = new Date().getFullYear();
      await holidays.refresh([year, year + 1]);
      return (await loadUserData(c, holidays, uid(request))).holidayCalendars;
    },
  );

  app.patch('/api/settings', auth, async (request) => {
    const userId = uid(request);
    const patch = settingsPatchSchema.parse(request.body);
    await c.settings.updateOne({ userId }, { $set: patch });
    return (await loadUserData(c, holidays, userId)).settings;
  });

  app.put('/api/categories/:id', auth, async (request, reply) => {
    const category = categorySchema.parse(request.body);
    if (category.id !== idSchema.parse(param(request, 'id'))) return reply.code(400).send({ error: 'id mismatch' });
    const userId = uid(request);
    await c.categories.replaceOne({ userId, id: category.id }, { ...category, userId }, { upsert: true });
    return category;
  });

  app.delete('/api/categories/:id', auth, async (request, reply) => {
    const id = idSchema.parse(param(request, 'id'));
    if (BUILT_IN_CATEGORIES.has(id)) return reply.code(400).send({ error: 'Built-in category cannot be deleted' });
    await c.categories.deleteOne({ userId: uid(request), id });
    return reply.code(204).send();
  });

  app.put('/api/beneficiaries/:id', auth, async (request, reply) => {
    const b = beneficiarySchema.parse(request.body);
    if (b.id !== idSchema.parse(param(request, 'id'))) return reply.code(400).send({ error: 'id mismatch' });
    const userId = uid(request);
    await c.beneficiaries.replaceOne({ userId, id: b.id }, { ...b, userId }, { upsert: true });
    return b;
  });

  app.delete('/api/beneficiaries/:id', auth, async (request, reply) => {
    const id = idSchema.parse(param(request, 'id'));
    const userId = uid(request);
    if (await c.days.findOne({ userId, presentIds: id }, { projection: { _id: 1 } })) {
      return reply.code(409).send({ error: 'Has attendance history; set an exit date instead' });
    }
    await c.beneficiaries.deleteOne({ userId, id });
    return reply.code(204).send();
  });

  app.put('/api/days/:date', auth, async (request, reply) => {
    const day = daySchema.parse(request.body);
    if (day.date !== isoDateSchema.parse(param(request, 'date'))) return reply.code(400).send({ error: 'date mismatch' });
    const userId = uid(request);
    await c.days.replaceOne({ userId, date: day.date }, { ...day, userId }, { upsert: true });
    return day;
  });

  app.put('/api/receipts/:id', auth, async (request, reply) => {
    const receipt = receiptSchema.parse(request.body);
    if (receipt.id !== idSchema.parse(param(request, 'id'))) return reply.code(400).send({ error: 'id mismatch' });
    const userId = uid(request);
    await c.receipts.replaceOne({ userId, id: receipt.id }, { ...receipt, userId }, { upsert: true });
    return receipt;
  });

  app.delete('/api/receipts/:id', auth, async (request, reply) => {
    await c.receipts.deleteOne({ userId: uid(request), id: idSchema.parse(param(request, 'id')) });
    return reply.code(204).send();
  });

  app.put('/api/month-metas/:month', auth, async (request, reply) => {
    const meta = monthMetaSchema.parse(request.body);
    if (meta.month !== monthSchema.parse(param(request, 'month'))) return reply.code(400).send({ error: 'month mismatch' });
    const userId = uid(request);
    await c.monthMetas.replaceOne({ userId, month: meta.month }, { ...meta, userId }, { upsert: true });
    return meta;
  });

  /** Replaces the whole account with a backup file. */
  app.post('/api/import', auth, async (request) => {
    const backup = backupSchema.parse(request.body);
    const userId = uid(request);
    await wipe(c, userId);
    const { id: _id, ...settings } = backup.settings;
    const own = <T extends object>(docs: T[]) => docs.map((d) => ({ ...d, userId }));
    await c.settings.insertOne({ ...settings, userId });
    if (backup.categories.length) await c.categories.insertMany(own(backup.categories));
    if (backup.beneficiaries.length) await c.beneficiaries.insertMany(own(backup.beneficiaries));
    if (backup.days.length) await c.days.insertMany(own(backup.days));
    if (backup.receipts.length) await c.receipts.insertMany(own(backup.receipts));
    if (backup.monthMetas.length) await c.monthMetas.insertMany(own(backup.monthMetas));
    return loadUserData(c, holidays, userId);
  });

  /** Restores the default rates, categories and other shared setup; every record is kept. */
  app.post('/api/defaults', auth, async (request) => {
    const userId = uid(request);
    await restoreDefaultSetup(c, userId);
    return loadUserData(c, holidays, userId);
  });

  /** Erases all records and restores the default injection, keeping the centre details. */
  app.post('/api/reset', auth, async (request) => {
    const userId = uid(request);
    const current = await c.settings.findOne({ userId });
    await wipe(c, userId);
    await seedUser(c, userId, current?.center ?? {}, { language: current?.language, paperSize: current?.paperSize });
    return loadUserData(c, holidays, userId);
  });
}
