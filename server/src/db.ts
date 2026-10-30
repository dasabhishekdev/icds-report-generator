import { MongoClient, type Collection, type Db, type ObjectId } from 'mongodb';
import type { Beneficiary, Category, DayRecord, MonthMeta, Settings, StockReceipt } from '../../src/db/schema';
import type { HolidaySource, StateHoliday } from '../../src/domain/holidays';
import type { PhotoContentType } from '../../src/domain/photoName';
import type { SealedSecret } from './portal/crypto';

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

export interface ReportFile {
  kind: 'pdf' | 'xlsx';
  key: string;
  name: string;
  size: number;
  contentType: string;
}

/** A generated month of reports; the files live in S3 (or the disk fallback) under the user's prefix. */
export interface ReportDoc {
  _id: ObjectId;
  userId: ObjectId;
  /** Month of `from`; reports are listed by it. */
  month: string;
  /** Inclusive period; absent on reports saved before date ranges existed (whole month). */
  from?: string;
  to?: string;
  /** Registers included; absent means all four. */
  sheets?: ('fuel' | 'voucher' | 'snp' | 'stock')[];
  paper: 'A4' | 'A3';
  createdAt: Date;
  storage: 's3' | 'disk';
  files: ReportFile[];
  summary: { servedDays: number; beneficiaryDays: number; purchaseTotal: number; fuelTotal: number };
}

/** A downloaded West Bengal holiday list; public data shared by all accounts. */
export interface HolidayCalendarDoc {
  /** `WB-<year>` */
  _id: string;
  year: number;
  source: Exclude<HolidaySource, 'built-in' | 'none'>;
  fetchedAt: Date;
  holidays: StateHoliday[];
}

/** A compressed Jan Andolan photo; the image and its thumbnail live in report storage under the user's prefix. */
export interface PhotoDoc {
  _id: ObjectId;
  userId: ObjectId;
  /** Month of `capturedAt` in India time; photos are listed by it. */
  month: string;
  name: string;
  contentType: PhotoContentType;
  size: number;
  width: number;
  height: number;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  capturedAt: Date;
  createdAt: Date;
  storage: 's3' | 'disk';
  key: string;
  thumbKey: string;
}

/** The worker's Poshan Abhiyaan portal login; the password is encrypted with PORTAL_SECRET. */
export interface PortalLoginDoc {
  userId: ObjectId;
  username: string;
  password: SealedSecret;
  updatedAt: Date;
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
  reports: Collection<ReportDoc>;
  holidayCalendars: Collection<HolidayCalendarDoc>;
  photos: Collection<PhotoDoc>;
  portalLogins: Collection<PortalLoginDoc>;
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
    reports: db.collection('reports'),
    holidayCalendars: db.collection('holidayCalendars'),
    photos: db.collection('photos'),
    portalLogins: db.collection('portalLogins'),
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
    c.reports.createIndex({ userId: 1, month: 1, createdAt: -1 }),
    c.photos.createIndex({ userId: 1, month: 1, capturedAt: -1 }),
    c.portalLogins.createIndex({ userId: 1 }, { unique: true }),
  ]);
}

export async function connect(url: string): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 10_000, ignoreUndefined: true });
  await client.connect();
  return { client, db: client.db() };
}
