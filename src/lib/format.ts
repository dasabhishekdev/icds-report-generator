import type { ItemKey, Language, MealType, StockItemKey } from '../db/schema';
import { dotted, lastDateOfMonth, monthLabel, monthOf } from '../domain/dates';
import type { StringKey } from '../i18n/strings';

export const ITEM_LABEL: Record<ItemKey, StringKey> = {
  rice: 'itemRice',
  dal: 'itemDal',
  oil: 'itemOil',
  salt: 'itemSalt',
  egg: 'itemEgg',
  veg: 'itemVeg',
  potato: 'itemPotato',
  chatu: 'itemChatu',
};

export const MEAL_LABEL: Record<MealType, StringKey> = { khichuri: 'khichuri', rice: 'rice' };

export function formatQty(item: ItemKey | StockItemKey, qty: number, t: (k: StringKey) => string): string {
  if (item === 'egg') return `${Number(qty.toFixed(2))} ${t('pcs')}`;
  if (Math.abs(qty) >= 1000) return `${(qty / 1000).toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`;
  return `${Number(qty.toFixed(2))} ${t('grams')}`;
}

/** "September 2026" for a whole month, otherwise "07.09.2026 – 12.09.2026". */
export function periodText(p: { from: string; to: string }, lang: Language): string {
  const month = monthOf(p.from);
  return p.from === `${month}-01` && p.to === lastDateOfMonth(month) ? monthLabel(month, lang) : `${dotted(p.from)} – ${dotted(p.to)}`;
}

export const rupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
