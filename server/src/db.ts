import { MongoClient, type Collection, type Db, type ObjectId } from 'mongodb';
import type { Beneficiary, Category, DayRecord, MonthMeta, Settings, StockReceipt } from '../../src/db/schema';

export interface UserDoc {
  _id: ObjectId;
  login: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
}

export interface SessionDoc {
  tokenHash: string;
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

/** Every application document carries its owner; all queries filter on userId. */
type Owned<T> = T & { userId: ObjectId };

export interface Collections {
  users: Collection<UserDoc>;
  sessions: Collection<SessionDoc>;
  settings: Collection<Owned<Omit<Settings, 'id'>>>;
  categories: Collection<Owned<Category>>;
  beneficiaries: Collection<Owned<Beneficiary>>;
  days: Collection<Owned<DayRecord>>;
  receipts: Collection<Owned<StockReceipt>>;
  monthMetas: Collection<Owned<MonthMeta>>;
}

export function collections(db: Db): Collections {
  return {
    users: db.collection('users'),
    sessions: db.collection('sessions'),
    settings: db.collection('settings'),
    categories: db.collection('categories'),
    beneficiaries: db.collection('beneficiaries'),
    days: db.collection('days'),
    receipts: db.collection('receipts'),
    monthMetas: db.collection('monthMetas'),
  };
}

export async function ensureIndexes(c: Collections): Promise<void> {
  await Promise.all([
    c.users.createIndex({ login: 1 }, { unique: true }),
    c.sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    c.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.sessions.createIndex({ userId: 1 }),
    c.settings.createIndex({ userId: 1 }, { unique: true }),
    c.categories.createIndex({ userId: 1, id: 1 }, { unique: true }),
    c.beneficiaries.createIndex({ userId: 1, id: 1 }, { unique: true }),
    c.days.createIndex({ userId: 1, date: 1 }, { unique: true }),
    c.days.createIndex({ userId: 1, presentIds: 1 }),
    c.receipts.createIndex({ userId: 1, id: 1 }, { unique: true }),
    c.monthMetas.createIndex({ userId: 1, month: 1 }, { unique: true }),
  ]);
}

export async function connect(url: string): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 10_000, ignoreUndefined: true });
  await client.connect();
  return { client, db: client.db() };
}
