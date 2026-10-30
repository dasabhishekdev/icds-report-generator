import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoClient } from 'mongodb';
import type { HolidayCalendarDoc } from '../src/db';
import { createHolidayService } from '../src/holidays/service';
import { holidaysFromWbIcs, indiaCalendarFeed, wbIcsFeed, cleanHolidays, type HolidayFeed } from '../src/holidays/sources';

const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'SUMMARY:NI (**) Birthday of Rabindranath Tagore',
  'DTSTART;VALUE=DATE:20260509',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:WB Durga Puja\\, Maha Chaturthi',
  'DTSTART;VALUE=DATE:20261015',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:WB Birth Day of Shri Shri Harichand Thakur (Madhu Krishna Troyodas',
  ' hi Tithi)',
  'DTSTART;VALUE=DATE:20260317',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:WB Hul Diwas [for Adibasi (Santhal) only]',
  'DTSTART;VALUE=DATE:20260630',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:NI Durga Puja\\, Maha Nabami',
  'DTSTART;VALUE=DATE:20261020',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:NI Durga Puja\\, Maha Nabami',
  'DTSTART;VALUE=DATE:20261020',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const respond = (status: number, body: string) => (async () => new Response(body, { status })) as unknown as typeof fetch;

describe('holiday feeds', () => {
  it('parses the WB iCal list: folding, escapes, List-I/II prefixes and tentative markers', () => {
    const list = cleanHolidays(2026, holidaysFromWbIcs(ICS));
    expect(list).toEqual([
      { date: '2026-03-17', name: 'Birth Day of Shri Shri Harichand Thakur (Madhu Krishna Troyodashi Tithi)', list: 'state' },
      { date: '2026-05-09', name: 'Birthday of Rabindranath Tagore', list: 'public' },
      { date: '2026-10-15', name: 'Durga Puja, Maha Chaturthi', list: 'state' },
      { date: '2026-10-20', name: 'Durga Puja, Maha Nabami', list: 'public' },
    ]);
  });

  it('treats a missing year as not published and other errors as failures', async () => {
    expect(await wbIcsFeed.fetchYear(2027, respond(404, 'Not Found'))).toBeNull();
    await expect(wbIcsFeed.fetchYear(2027, respond(500, 'boom'))).rejects.toThrow('HTTP 500');
  });

  it('keeps only state-level gazetted days from the India Calendar API', async () => {
    const body = JSON.stringify({
      data: [
        { date: '2026-01-26', name: 'Republic Day', type: 'gazetted_holiday', level: 'state' },
        { date: '2026-01-14', name: 'Makar Sankranti', type: 'restricted_holiday', level: 'central' },
      ],
    });
    expect(await indiaCalendarFeed.fetchYear(2026, respond(200, body))).toEqual([{ date: '2026-01-26', name: 'Republic Day', list: 'public' }]);
  });
});

const MONGO_URL = process.env.MONGO_URL;

describe.skipIf(!MONGO_URL)('holiday service', () => {
  let client: MongoClient;
  const dbName = `icds-holidays-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const collection = () => client.db(dbName).collection<HolidayCalendarDoc>('holidayCalendars');

  beforeAll(async () => {
    client = new MongoClient(MONGO_URL!);
    await client.connect();
  });
  afterAll(async () => {
    await client?.db(dbName).dropDatabase();
    await client?.close();
  });

  const feed = (source: HolidayFeed['source'], byYear: Record<number, string[] | 'fail'>): HolidayFeed & { calls: number } => {
    const f = {
      source,
      calls: 0,
      async fetchYear(year: number) {
        f.calls += 1;
        const v = byYear[year];
        if (v === 'fail') throw new Error('offline');
        return v ? v.map((date) => ({ date, name: `${source} ${date}`, list: 'public' as const })) : null;
      },
    };
    return f;
  };

  it('serves the built-in list until a download succeeds, then the cached one', async () => {
    const primary = feed('wb-ics', { 2026: 'fail' });
    const fallback = feed('india-calendar-api', { 2026: ['2026-01-26'] });
    const service = createHolidayService(collection(), { sync: true, feeds: [primary, fallback] });

    const [first] = await service.calendars([2026]);
    expect(first.source).toBe('built-in');
    expect(first.holidays.length).toBeGreaterThan(50);

    await service.refresh([2026]);
    const [second] = await service.calendars([2026]);
    expect(second).toMatchObject({ source: 'india-calendar-api', holidays: [{ date: '2026-01-26' }] });
    expect(second.fetchedAt).not.toBeNull();
  });

  it('picks up a newly published year and backs off while it is missing', async () => {
    let published = false;
    const source: HolidayFeed = {
      source: 'wb-ics',
      fetchYear: async (year) => (published ? [{ date: `${year}-01-26`, name: 'Republic Day', list: 'public' }] : null),
    };
    const service = createHolidayService(collection(), { sync: true, feeds: [source] });
    await service.refresh([2031]);
    expect((await service.calendars([2031]))[0]).toMatchObject({ source: 'none', holidays: [] });

    published = true;
    await service.refresh([2031]);
    expect((await service.calendars([2031]))[0]).toMatchObject({ source: 'wb-ics', holidays: [{ date: '2031-01-26' }] });
  });

  it('never downloads when sync is off', async () => {
    const primary = feed('wb-ics', { 2032: ['2032-01-26'] });
    const service = createHolidayService(collection(), { sync: false, feeds: [primary] });
    await service.calendars([2032]);
    await service.refresh([2032]);
    expect(primary.calls).toBe(0);
  });
});
