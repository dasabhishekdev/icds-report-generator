import type { Settings, StateHolidayMode } from '../db/schema';

/**
 * West Bengal Government holiday lists, as notified each year by the Finance (Audit) Department:
 * List-I are public holidays under the N.I. Act, List-II are days state offices are closed by order.
 */
export type StateHolidayList = 'public' | 'state';

export interface StateHoliday {
  date: string;
  name: string;
  list: StateHolidayList;
}

/** Where a year's list came from; 'none' means the Government has not published it yet. */
export type HolidaySource = 'wb-ics' | 'india-calendar-api' | 'built-in' | 'none';

export interface HolidayCalendar {
  year: number;
  source: HolidaySource;
  /** ISO timestamp of the last successful download; null for built-in or missing lists. */
  fetchedAt: string | null;
  holidays: StateHoliday[];
}

export const stateHolidayMode = (settings: Settings): StateHolidayMode => settings.stateHolidays ?? 'all';

export function isOpenOnStateHoliday(settings: Settings, date: string): boolean {
  return settings.openOnStateHolidays?.includes(date) ?? false;
}

/** State holidays on a date that the centre's settings let close it. */
export function stateHolidaysOn(date: string, settings: Settings, calendars: readonly HolidayCalendar[]): StateHoliday[] {
  const mode = stateHolidayMode(settings);
  if (mode === 'off' || isOpenOnStateHoliday(settings, date)) return [];
  const year = Number(date.slice(0, 4));
  const calendar = calendars.find((c) => c.year === year);
  if (!calendar) return [];
  return calendar.holidays.filter((h) => h.date === date && (mode === 'all' || h.list === 'public'));
}

export interface CalendarHoliday {
  name: string;
  source: 'custom' | 'state';
}

/** The centre's own holiday wins over the state calendar on the same date. */
export function calendarHolidayOn(date: string, settings: Settings, calendars: readonly HolidayCalendar[]): CalendarHoliday | undefined {
  const custom = settings.holidays.find((h) => h.date === date);
  if (custom) return { name: custom.name, source: 'custom' };
  const state = stateHolidaysOn(date, settings, calendars);
  if (state.length === 0) return undefined;
  return { name: [...new Set(state.map((h) => h.name))].join(' / '), source: 'state' };
}
