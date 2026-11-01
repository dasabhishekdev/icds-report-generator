import type { MealType, StockItemKey } from '../db/schema';
import { dotted, monthLabel, monthShort, parseIso, weekday } from '../domain/dates';
import type { DayRow, MonthSummary } from '../domain/month';

export function mealLabel(meal: MealType, withCode: boolean): string {
  switch (meal) {
    case 'khichuri':
      return withCode ? 'খিচুড়ি (Kh)' : 'খিচুড়ি';
    case 'rice':
      return withCode ? 'ভাত (Bh)' : 'ভাত';
    default: {
      const never: never = meal;
      return never;
    }
  }
}

/** Remark for a closed day: festival name if given, otherwise the weekday. */
export function holidayText(row: DayRow, style: 'long' | 'short'): string {
  if (row.status.label) return row.status.label;
  const sunday = weekday(row.date) === 0;
  if (style === 'long') return sunday ? 'রবিবার / ছুটি (Sunday)' : 'ছুটি (Holiday)';
  return sunday ? 'রবিবার (Sun)' : 'ছুটি (Holiday)';
}

/** "September 2026" for a whole month, otherwise "05.10.2026 - 20.10.2026". */
export function periodLabel(summary: MonthSummary): string {
  const { period } = summary;
  return period.fullMonth ? monthLabel(summary.month) : `${dotted(period.from)} - ${dotted(period.to)}`;
}

/** Header prefix matching periodLabel: "মাস ও সাল" for a month, "সময়কাল" for a date range. */
export function periodCaption(summary: MonthSummary): string {
  return summary.period.fullMonth ? 'মাস ও সাল' : 'সময়কাল';
}

/** File-name part: "Sep2026" for a month, "05Oct-20Oct2026" for a range. */
export function periodSlug(summary: MonthSummary): string {
  const { period } = summary;
  if (period.fullMonth) return monthShort(summary.month);
  const part = (iso: string) => `${String(parseIso(iso).d).padStart(2, '0')}${monthShort(iso.slice(0, 7)).slice(0, 3)}`;
  return `${part(period.from)}-${part(period.to)}${parseIso(period.to).y}`;
}

/** Date column: day of month, or dd.mm when the period crosses months. */
export function dayLabel(row: DayRow, summary: MonthSummary): number | string {
  return summary.period.singleMonth ? row.day : dotted(row.date).slice(0, 5);
}

export const STOCK_LABEL: Record<StockItemKey, string> = {
  rice: 'চাল',
  dal: 'ডাল',
  oil: 'তেল',
  salt: 'লবন',
  turmeric: 'হলুদ',
};

export const STOCK_LABEL_EN: Record<StockItemKey, string> = {
  rice: 'Rice',
  dal: 'Dal',
  oil: 'Oil',
  salt: 'Salt',
  turmeric: 'Turmeric',
};

export function stockUnit(item: StockItemKey): string {
  return item === 'oil' ? 'Lit' : 'Kg';
}

export const inr = (n: number, digits = 2) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const trimNum = (n: number) => Number(n.toFixed(3)).toString();

export function splitRupees(amount: number): { rupees: number; paise: number } {
  const paiseTotal = Math.round(amount * 100);
  return { rupees: Math.floor(paiseTotal / 100), paise: paiseTotal % 100 };
}

/** "1186 টাকা 65 পয়সা", as amounts are written in words on the bills. */
export function takaPaisa(amount: number): string {
  const { rupees, paise } = splitRupees(amount);
  return `${inr(rupees, 0)} টাকা ${paise} পয়সা`;
}
