import {
  ITEM_KEYS,
  type Beneficiary,
  type Category,
  type CategoryGroup,
  type Gender,
  type ItemQuantities,
  type MealType,
  type PurchasedItemKey,
  type Settings,
} from '../db/schema';
import { ageGroupMonths } from './dates';
import { resolveCategory } from './eligibility';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Fixed age bands printed in the government stock register (`ageGroupMonths`, [min, max)). */
export const STOCK_AGE_BANDS = [
  { key: '7m-1y', label: '7M-1Y', min: 6, max: 12 },
  { key: '1y-2y', label: '1Y-2Y', min: 12, max: 24 },
  { key: '2y-3y', label: '2Y-3Y', min: 24, max: 36 },
  { key: '3y-5y', label: '3Y-5Y', min: 36, max: 60 },
  { key: '5y-6y', label: '5Y-6Y', min: 60, max: 72 },
] as const;
export type StockAgeBand = (typeof STOCK_AGE_BANDS)[number]['key'];

export interface DayCounts {
  byCategory: Record<string, number>;
  pregnant: number;
  nursing: number;
  mothers: number;
  children: number;
  total: number;
  /** Children 6 months – 3 years and 3 – 6 years, as printed on the fuel register. */
  childUnder3: number;
  child3to6: number;
  bands: Record<StockAgeBand, Record<Gender, number>>;
}

export function emptyCounts(): DayCounts {
  const bands = Object.fromEntries(STOCK_AGE_BANDS.map((b) => [b.key, { M: 0, F: 0 }])) as DayCounts['bands'];
  return { byCategory: {}, pregnant: 0, nursing: 0, mothers: 0, children: 0, total: 0, childUnder3: 0, child3to6: 0, bands };
}

/** Counts the present beneficiaries who are eligible for a meal on this date. */
export function countPresent(
  presentIds: readonly string[],
  date: string,
  beneficiaries: ReadonlyMap<string, Beneficiary>,
  categories: readonly Category[],
  nursingMonths: number,
): DayCounts {
  const counts = emptyCounts();
  for (const id of presentIds) {
    const b = beneficiaries.get(id);
    if (!b) continue;
    const cat = resolveCategory(b, date, categories, nursingMonths);
    if (!cat || !cat.servesMeal) continue;
    counts.byCategory[cat.id] = (counts.byCategory[cat.id] ?? 0) + 1;
    counts.total += 1;
    if (b.kind === 'mother') {
      counts.mothers += 1;
      if (cat.motherStage === 'nursing') counts.nursing += 1;
      else counts.pregnant += 1;
      continue;
    }
    counts.children += 1;
    const age = b.dob ? ageGroupMonths(b.dob, date) : -1;
    if (age < 36) counts.childUnder3 += 1;
    else counts.child3to6 += 1;
    const band = STOCK_AGE_BANDS.find((x) => x.min <= age && age < x.max);
    if (band) counts.bands[band.key][b.gender] += 1;
  }
  return counts;
}

export type Ration = Record<CategoryGroup | 'total', ItemQuantities>;

export const zeroItems = (): ItemQuantities => Object.fromEntries(ITEM_KEYS.map((k) => [k, 0])) as ItemQuantities;

/** Total ration for a day = Σ (present in category × per-head norm for the meal). */
export function dayRation(meal: MealType, byCategory: Record<string, number>, categories: readonly Category[]): Ration {
  const ration: Ration = { mother: zeroItems(), child: zeroItems(), total: zeroItems() };
  for (const cat of categories) {
    const n = byCategory[cat.id] ?? 0;
    if (!n) continue;
    for (const item of ITEM_KEYS) {
      const qty = n * (cat.norms[meal][item] ?? 0);
      ration[cat.group][item] += qty;
      ration.total[item] += qty;
    }
  }
  for (const part of [ration.mother, ration.child, ration.total]) {
    for (const item of ITEM_KEYS) part[item] = round2(part[item]);
  }
  return ration;
}

/** Rupee costs per day as laid out in the SNP vegetable & egg register. */
export interface DayCosts {
  motherVeg: number;
  motherPotato: number;
  chatu: number;
  egg: number;
  childVeg: number;
  childPotato: number;
  total: number;
}

/** Money for one head's quantity of a bought item: eggs by the piece, the rest at the per-kg rate. */
export const itemCost = (item: PurchasedItemKey, qty: number, rates: Settings['rates']): number =>
  round2(item === 'egg' ? qty * rates.egg : (qty * rates[item]) / 1000);

export function dayCosts(ration: Ration, rates: Settings['rates']): DayCosts {
  const perGram = (kgRate: number) => kgRate / 1000;
  const c = {
    motherVeg: round2(ration.mother.veg * perGram(rates.veg)),
    motherPotato: round2(ration.mother.potato * perGram(rates.potato)),
    chatu: round2(ration.total.chatu * perGram(rates.chatu)),
    egg: round2(ration.total.egg * rates.egg),
    childVeg: round2(ration.child.veg * perGram(rates.veg)),
    childPotato: round2(ration.child.potato * perGram(rates.potato)),
  };
  return { ...c, total: round2(c.motherVeg + c.motherPotato + c.chatu + c.egg + c.childVeg + c.childPotato) };
}
