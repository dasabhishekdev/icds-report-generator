import type { HolidaySource, StateHoliday } from '../../../src/domain/holidays';

/**
 * West Bengal publishes its holiday list only as a yearly Finance (Audit) Department PDF notification,
 * so there is no official API. These keyless feeds transcribe it; the first one that has the year wins.
 */
export interface HolidayFeed {
  source: Exclude<HolidaySource, 'built-in' | 'none'>;
  fetchYear(year: number, fetchImpl: typeof fetch): Promise<StateHoliday[] | null>;
}

const TIMEOUT_MS = 15_000;
/** District- or community-specific days ("for Darjeeling & Kalimpong District only", "for Adibasi (Santhal) only"). */
const RESTRICTED = /\bonly\b/i;

async function getText(url: string, fetchImpl: typeof fetch): Promise<string | null> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'icds-report-generator' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Drops restricted days, other years and duplicates; keeps one entry per (date, list, name). */
export function cleanHolidays(year: number, holidays: StateHoliday[]): StateHoliday[] {
  const seen = new Set<string>();
  return holidays
    .filter((h) => ISO.test(h.date) && h.date.startsWith(`${year}-`) && h.name && !RESTRICTED.test(h.name))
    .filter((h) => {
      const key = `${h.date}|${h.list}|${h.name.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.date === b.date ? a.list.localeCompare(b.list) : a.date < b.date ? -1 : 1));
}

/** RFC 5545 unfolding, then SUMMARY and all-day DTSTART of each VEVENT. */
export function parseIcs(text: string): { summary: string; date: string }[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: { summary: string; date: string }[] = [];
  let summary: string | null = null;
  let date: string | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      summary = null;
      date = null;
    } else if (line === 'END:VEVENT') {
      if (summary && date) events.push({ summary, date });
    } else if (line.startsWith('SUMMARY')) {
      summary = line
        .slice(line.indexOf(':') + 1)
        .replace(/\\([,;\\])/g, '$1')
        .replace(/\\n/gi, ' ')
        .trim();
    } else if (line.startsWith('DTSTART')) {
      const m = /:(\d{4})(\d{2})(\d{2})/.exec(line);
      if (m) date = `${m[1]}-${m[2]}-${m[3]}`;
    }
  }
  return events;
}

/** Summaries are "NI <name>" (List-I, N.I. Act) or "WB <name>" (List-II); "(**)" marks dates that may still change. */
export function holidaysFromWbIcs(text: string): StateHoliday[] {
  return parseIcs(text).map(({ summary, date }) => {
    const prefix = /^(NI|WB)\s+/.exec(summary);
    const name = summary
      .slice(prefix ? prefix[0].length : 0)
      .replace(/\(\*+\)\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { date, name, list: prefix?.[1] === 'WB' ? 'state' : 'public' };
  });
}

export const wbIcsFeed: HolidayFeed = {
  source: 'wb-ics',
  async fetchYear(year, fetchImpl) {
    const text = await getText(`https://raw.githubusercontent.com/anbe108/govt-holiday/main/WB-${year}.ics`, fetchImpl);
    return text ? cleanHolidays(year, holidaysFromWbIcs(text)) : null;
  },
};

interface IndiaCalendarResponse {
  data?: { date?: string; name?: string; type?: string; level?: string }[];
}

/** State-level gazetted holidays only, which is List-I; List-II office closures are not in this API. */
export const indiaCalendarFeed: HolidayFeed = {
  source: 'india-calendar-api',
  async fetchYear(year, fetchImpl) {
    const text = await getText(`https://calendar-api-d7a8.onrender.com/v1/holidays?country=IN&year=${year}&region=WB`, fetchImpl);
    if (!text) return null;
    const body = JSON.parse(text) as IndiaCalendarResponse;
    const holidays = (body.data ?? [])
      .filter((h) => h.level === 'state' && h.type === 'gazetted_holiday' && h.date && h.name)
      .map((h): StateHoliday => ({ date: h.date!, name: h.name!.trim(), list: 'public' }));
    return cleanHolidays(year, holidays);
  },
};

export const DEFAULT_FEEDS: readonly HolidayFeed[] = [wbIcsFeed, indiaCalendarFeed];
