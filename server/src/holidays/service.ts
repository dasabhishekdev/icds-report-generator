import type { Collection } from 'mongodb';
import type { HolidayCalendar } from '../../../src/domain/holidays';
import type { HolidayCalendarDoc } from '../db';
import { BUILT_IN_HOLIDAYS } from './builtin';
import { DEFAULT_FEEDS, type HolidayFeed } from './sources';

export interface HolidayService {
  /** Cached lists (built-in or empty when never downloaded); stale years are refreshed in the background. */
  calendars(years: readonly number[]): Promise<HolidayCalendar[]>;
  /** Downloads the years now, ignoring the retry back-off. */
  refresh(years: readonly number[]): Promise<void>;
  start(): void;
  stop(): void;
}

export interface HolidayServiceOptions {
  /** Off in tests and when the server has no internet; only cached and built-in lists are served. */
  sync: boolean;
  feeds?: readonly HolidayFeed[];
  fetchImpl?: typeof fetch;
  now?: () => Date;
  warn?: (message: string) => void;
}

const HOUR = 3_600_000;
/** A downloaded year is re-checked this often so amendments to the notification are picked up. */
const REFRESH_AFTER = 12 * HOUR;
/** Back-off after a failed or empty download (e.g. next year's list is not out yet). */
const RETRY_AFTER = 3 * HOUR;
const TICK = 6 * HOUR;

const docId = (year: number) => `WB-${year}`;

function toCalendar(year: number, doc: HolidayCalendarDoc | undefined): HolidayCalendar {
  if (doc) return { year, source: doc.source, fetchedAt: doc.fetchedAt.toISOString(), holidays: doc.holidays };
  const builtIn = BUILT_IN_HOLIDAYS[year];
  if (builtIn) return { year, source: 'built-in', fetchedAt: null, holidays: [...builtIn] };
  return { year, source: 'none', fetchedAt: null, holidays: [] };
}

export function createHolidayService(collection: Collection<HolidayCalendarDoc>, options: HolidayServiceOptions): HolidayService {
  const feeds = options.feeds ?? DEFAULT_FEEDS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const warn = options.warn ?? (() => undefined);
  const lastAttempt = new Map<number, number>();
  const inFlight = new Map<number, Promise<void>>();
  let timer: NodeJS.Timeout | null = null;

  async function download(year: number): Promise<void> {
    lastAttempt.set(year, now().getTime());
    for (const feed of feeds) {
      try {
        const holidays = await feed.fetchYear(year, fetchImpl);
        if (!holidays?.length) continue;
        const doc: HolidayCalendarDoc = { _id: docId(year), year, source: feed.source, fetchedAt: now(), holidays };
        await collection.replaceOne({ _id: doc._id }, doc, { upsert: true });
        return;
      } catch (error) {
        warn(`holiday feed ${feed.source} ${year}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  function refreshYear(year: number): Promise<void> {
    const running = inFlight.get(year);
    if (running) return running;
    const task = download(year).finally(() => inFlight.delete(year));
    inFlight.set(year, task);
    return task;
  }

  const isDue = (year: number, doc: HolidayCalendarDoc | undefined) => {
    const t = now().getTime();
    if (t - (lastAttempt.get(year) ?? 0) < RETRY_AFTER) return false;
    return !doc || t - doc.fetchedAt.getTime() >= REFRESH_AFTER;
  };

  const upcomingYears = () => {
    const year = now().getFullYear();
    return [year, year + 1];
  };

  return {
    async calendars(years) {
      const docs = await collection.find({ _id: { $in: years.map(docId) } }).toArray();
      const byYear = new Map(docs.map((d) => [d.year, d]));
      if (options.sync) {
        for (const year of years) if (isDue(year, byYear.get(year))) void refreshYear(year);
      }
      return years.map((year) => toCalendar(year, byYear.get(year)));
    },

    async refresh(years) {
      if (!options.sync) return;
      await Promise.all(years.map(refreshYear));
    },

    start() {
      if (!options.sync || timer) return;
      const tick = async () => {
        const years = upcomingYears();
        const docs = await collection.find({ _id: { $in: years.map(docId) } }).toArray();
        const byYear = new Map(docs.map((d) => [d.year, d]));
        await Promise.all(years.filter((y) => isDue(y, byYear.get(y))).map(refreshYear));
      };
      const run = () => void tick().catch((error) => warn(`holiday sync: ${error instanceof Error ? error.message : String(error)}`));
      run();
      timer = setInterval(run, TICK);
      timer.unref();
    },

    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
