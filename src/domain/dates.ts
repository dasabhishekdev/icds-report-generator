/** All dates are plain 'YYYY-MM-DD' strings and months are 'YYYY-MM' so no timezone can shift them. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function todayIso(): string {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonth(): string {
  return monthOf(todayIso());
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthDates(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: daysInMonth(month) }, (_, i) => toIso(y, m, i + 1));
}

export function weekday(iso: string): number {
  const { y, m, d } = parseIso(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseIso(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseIso(iso);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth() + 1;
  const lastDay = daysInMonth(`${ty}-${pad(tm)}`);
  return toIso(ty, tm, Math.min(d, lastDay));
}

export function shiftMonth(month: string, delta: number): string {
  return addMonths(`${month}-01`, delta).slice(0, 7);
}

/** Inclusive list of dates from `from` to `to` (empty when to < from). */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function daysBetweenInclusive(from: string, to: string): number {
  const a = parseIso(from);
  const b = parseIso(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000) + 1;
}

export function lastDateOfMonth(month: string): string {
  return `${month}-${pad(daysInMonth(month))}`;
}

/** Completed months between dob and date (negative if not yet born). */
export function ageInMonths(dob: string, date: string): number {
  const a = parseIso(dob);
  const b = parseIso(date);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months -= 1;
  return months;
}

/**
 * Completed months for age-group rules (categories, register bands). The anniversary itself still
 * counts in the younger group: a child born 2023-01-15 is 35 months on 2026-01-15 and 36 on 2026-01-16,
 * i.e. moves from "6 months – 3 years" to "3 – 6 years" at 3 years + 1 day. -1 before birth.
 */
export function ageGroupMonths(dob: string, date: string): number {
  if (date < dob) return -1;
  return Math.max(0, ageInMonths(dob, addDays(date, -1)));
}

/** First date on which `ageGroupMonths` reaches `months`. */
export function dateReachingAgeGroup(dob: string, months: number): string {
  let date = addMonths(dob, months);
  while (ageGroupMonths(dob, date) < months) date = addDays(date, 1);
  return date;
}

/** An age in whole months as words, e.g. "6 months", "3 years", "1 year 6 months". */
export function formatMonths(months: number, lang: 'bn' | 'en'): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (lang === 'bn') {
    const parts = [y > 0 ? `${y} বছর` : '', m > 0 || y === 0 ? `${m} মাস` : ''];
    return parts.filter(Boolean).join(' ');
  }
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [y > 0 ? unit(y, 'year') : '', m > 0 || y === 0 ? unit(m, 'month') : ''].filter(Boolean).join(' ');
}

export function formatAge(months: number, lang: 'bn' | 'en'): string {
  if (months < 0) return '—';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (lang === 'bn') return y > 0 ? `${y} বছর ${m} মাস` : `${m} মাস`;
  return y > 0 ? `${y}y ${m}m` : `${m}m`;
}

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_BN = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];
export const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];

/** Month name for 1–12. */
export const monthName = (m: number, lang: 'bn' | 'en') => (lang === 'bn' ? MONTH_NAMES_BN : MONTH_NAMES_EN)[m - 1];

export function monthLabel(month: string, lang: 'bn' | 'en' = 'en'): string {
  const [y, m] = month.split('-').map(Number);
  return `${(lang === 'bn' ? MONTH_NAMES_BN : MONTH_NAMES_EN)[m - 1]} ${y}`;
}

/** Compact English month used in file names, e.g. "Sep2026". */
export function monthShort(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES_EN[m - 1].slice(0, 3)}${y}`;
}

/** 'DD.MM.YYYY' as used on the voucher. */
export function dotted(iso: string): string {
  const { y, m, d } = parseIso(iso);
  return `${pad(d)}.${pad(m)}.${y}`;
}

export function prettyDate(iso: string, lang: 'bn' | 'en'): string {
  const { d, m } = parseIso(iso);
  const wd = (lang === 'bn' ? WEEKDAYS_BN : WEEKDAYS_EN)[weekday(iso)];
  const name = (lang === 'bn' ? MONTH_NAMES_BN : MONTH_NAMES_EN)[m - 1];
  return `${wd}, ${d} ${name}`;
}
