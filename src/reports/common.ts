import type { MealType, StockItemKey } from '../db/schema';
import { weekday } from '../domain/dates';
import type { DayRow } from '../domain/month';

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

export const STOCK_LABEL: Record<StockItemKey, string> = {
  chatu: 'ছাতু',
  rice: 'চাল',
  dal: 'ডাল',
  oil: 'তেল',
  salt: 'লবন',
};

export const STOCK_LABEL_EN: Record<StockItemKey, string> = {
  chatu: 'Chatu',
  rice: 'Rice',
  dal: 'Dal',
  oil: 'Oil',
  salt: 'Salt',
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
