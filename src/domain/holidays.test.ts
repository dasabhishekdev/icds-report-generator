import { describe, expect, it } from 'vitest';
import { defaultCategories, defaultSettings } from '../db/defaults';
import { sampleData } from '../db/sampleData';
import type { ChildBeneficiary, Settings } from '../db/schema';
import { ageGroupMonths, dateReachingAgeGroup, formatMonths } from './dates';
import { childrenWithoutDob, nextChildShift, resolveCategory } from './eligibility';
import { calendarHolidayOn, type HolidayCalendar } from './holidays';
import { buildMonthSummary, resolveDayStatus } from './month';

const categories = defaultCategories();
const child = (dob?: string): ChildBeneficiary => ({ id: 'c1', kind: 'child', name: 'Rahul', gender: 'M', dob, enrolledOn: '2020-01-01' });
const categoryOn = (dob: string, date: string) => resolveCategory(child(dob), date, categories, 6)?.id ?? null;

describe('age categories shift the day after the anniversary', () => {
  it('keeps a child in 6 months – 3 years on the 3rd birthday and moves them at 3 years + 1 day', () => {
    expect(categoryOn('2023-01-15', '2026-01-14')).toBe('child-6m-3y');
    expect(categoryOn('2023-01-15', '2026-01-15')).toBe('child-6m-3y');
    expect(categoryOn('2023-01-15', '2026-01-16')).toBe('child-3y-6y');
  });

  it('applies the same rule at 6 months and at 6 years', () => {
    expect(categoryOn('2026-01-15', '2026-07-15')).toBe('child-0-6m');
    expect(categoryOn('2026-01-15', '2026-07-16')).toBe('child-6m-3y');
    expect(categoryOn('2020-01-15', '2026-01-15')).toBe('child-3y-6y');
    expect(categoryOn('2020-01-15', '2026-01-16')).toBeNull();
  });

  it('handles month ends and leap days', () => {
    expect(ageGroupMonths('2024-01-31', '2024-01-31')).toBe(0);
    expect(ageGroupMonths('2024-01-31', '2024-01-30')).toBe(-1);
    expect(dateReachingAgeGroup('2023-01-15', 36)).toBe('2026-01-16');
    expect(dateReachingAgeGroup('2024-02-29', 36)).toBe('2027-03-02');
  });

  it('predicts the next move', () => {
    expect(nextChildShift(child('2023-01-15'), '2025-06-01', categories)).toMatchObject({ on: '2026-01-16', to: { id: 'child-3y-6y' } });
    expect(nextChildShift(child('2020-01-15'), '2025-06-01', categories)).toMatchObject({ on: '2026-01-16', to: null });
  });

  it('leaves a child without a date of birth uncategorised and reports them', () => {
    expect(resolveCategory(child(), '2026-01-01', categories, 6)).toBeNull();
    expect(childrenWithoutDob([child(), child('2024-01-01')], '2026-01-01')).toHaveLength(1);
  });

  it('formats ranges in words', () => {
    expect(formatMonths(6, 'en')).toBe('6 months');
    expect(formatMonths(36, 'en')).toBe('3 years');
    expect(formatMonths(18, 'en')).toBe('1 year 6 months');
    expect(formatMonths(36, 'bn')).toBe('3 বছর');
  });
});

describe('West Bengal holiday calendar', () => {
  const calendars: HolidayCalendar[] = [
    {
      year: 2026,
      source: 'wb-ics',
      fetchedAt: '2026-10-01T00:00:00.000Z',
      holidays: [
        { date: '2026-01-23', name: 'Netaji’s Birthday', list: 'public' },
        { date: '2026-01-23', name: 'Saraswati Puja', list: 'public' },
        { date: '2026-09-17', name: 'Viswakarma Puja', list: 'state' },
        { date: '2026-10-02', name: 'Birthday of Gandhiji', list: 'public' },
      ],
    },
  ];
  const base = defaultSettings();
  const withSettings = (patch: Partial<Settings>): Settings => ({ ...base, ...patch });

  it('closes on List-I and List-II days by default and joins names on the same date', () => {
    expect(calendarHolidayOn('2026-01-23', base, calendars)).toEqual({ name: 'Netaji’s Birthday / Saraswati Puja', source: 'state' });
    expect(calendarHolidayOn('2026-09-17', base, calendars)?.name).toBe('Viswakarma Puja');
    expect(calendarHolidayOn('2026-09-18', base, calendars)).toBeUndefined();
  });

  it('can be limited to List-I or switched off', () => {
    expect(calendarHolidayOn('2026-09-17', withSettings({ stateHolidays: 'public' }), calendars)).toBeUndefined();
    expect(calendarHolidayOn('2026-10-02', withSettings({ stateHolidays: 'public' }), calendars)).toBeDefined();
    expect(calendarHolidayOn('2026-10-02', withSettings({ stateHolidays: 'off' }), calendars)).toBeUndefined();
  });

  it('drops the holiday tag on days marked open, and the centre’s own holidays win', () => {
    expect(calendarHolidayOn('2026-10-02', withSettings({ openOnStateHolidays: ['2026-10-02'] }), calendars)).toBeUndefined();
    const own = withSettings({ holidays: [{ date: '2026-10-02', name: 'Local fair' }] });
    expect(calendarHolidayOn('2026-10-02', own, calendars)).toEqual({ name: 'Local fair', source: 'custom' });
  });

  it('marks unrecorded days only; a saved working day stays open', () => {
    expect(resolveDayStatus('2026-10-02', undefined, base, calendars)).toMatchObject({ kind: 'holiday', holidaySource: 'state' });
    const day = { date: '2026-10-02', status: 'working' as const, meal: 'rice' as const, presentIds: [], updatedAt: 1 };
    expect(resolveDayStatus('2026-10-02', day, base, calendars).kind).toBe('working');
  });

  it('flows into the month summary without touching days with attendance', () => {
    const data = { ...sampleData(), holidayCalendars: calendars };
    const september = buildMonthSummary('2026-09', data);
    expect(september.rows[16].status.kind).toBe('working');
    expect(september.servedDays).toBe(27);
    const october = buildMonthSummary('2026-10', data);
    expect(october.rows[1].status).toMatchObject({ kind: 'holiday', label: 'Birthday of Gandhiji' });
  });
});
