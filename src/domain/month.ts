import {
  ITEM_KEYS,
  MEAL_TYPES,
  STOCK_ITEM_KEYS,
  type Beneficiary,
  type Category,
  type DayRecord,
  type MealType,
  type MonthMeta,
  type Settings,
  type StockItemKey,
  type StockReceipt,
} from '../db/schema';
import { ageInMonths, lastDateOfMonth, monthDates, monthOf, shiftMonth, weekday } from './dates';
import { resolveCategory } from './eligibility';
import {
  countPresent,
  dayCosts,
  dayRation,
  emptyCounts,
  round2,
  STOCK_AGE_BANDS,
  type DayCosts,
  type DayCounts,
  type Ration,
} from './calc';

export interface AppData {
  settings: Settings;
  categories: Category[];
  beneficiaries: Beneficiary[];
  days: DayRecord[];
  receipts: StockReceipt[];
  monthMetas: MonthMeta[];
}

export type DayKind = 'working' | 'holiday' | 'unrecorded';

export interface DayStatus {
  kind: DayKind;
  /** Holiday name (festival) – empty for a plain weekly off. */
  label?: string;
  isWeeklyOff: boolean;
}

export function resolveDayStatus(date: string, record: DayRecord | undefined, settings: Settings): DayStatus {
  const isWeeklyOff = settings.weeklyOffDays.includes(weekday(date));
  if (record) {
    return record.status === 'working'
      ? { kind: 'working', isWeeklyOff }
      : { kind: 'holiday', label: record.holidayReason, isWeeklyOff };
  }
  const holiday = settings.holidays.find((h) => h.date === date);
  if (holiday) return { kind: 'holiday', label: holiday.name, isWeeklyOff };
  if (isWeeklyOff) return { kind: 'holiday', isWeeklyOff };
  return { kind: 'unrecorded', isWeeklyOff };
}

export type SubmissionState = 'none' | 'submitted' | 'changed';

/** A submitted day that was edited afterwards needs to be submitted again. */
export function submissionState(record: DayRecord | undefined): SubmissionState {
  if (record?.submittedAt === undefined) return 'none';
  return record.updatedAt > record.submittedAt ? 'changed' : 'submitted';
}

/** Alternate the meal: the opposite of the last working day before `date`, starting with khichuri. */
export function suggestMeal(date: string, days: readonly DayRecord[]): MealType {
  const previous = days
    .filter((d) => d.date < date && d.status === 'working')
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!previous) return 'khichuri';
  return previous.meal === 'khichuri' ? 'rice' : 'khichuri';
}

export type StockQuantities = Record<StockItemKey, number>;
const zeroStock = (): StockQuantities => ({ chatu: 0, rice: 0, dal: 0, oil: 0, salt: 0 });

export interface DayRow {
  date: string;
  day: number;
  status: DayStatus;
  meal?: MealType;
  /** True when a meal was cooked (working day with at least one beneficiary present). */
  served: boolean;
  submitted: boolean;
  counts: DayCounts;
  ration: Ration;
  costs: DayCosts;
  receipts: StockQuantities;
  consumption: StockQuantities;
  closing: StockQuantities;
}

export interface FuelLine {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface MonthSummary {
  month: string;
  rows: DayRow[];
  servedDays: number;
  firstDate: string;
  lastDate: string;
  totals: { counts: DayCounts; ration: Ration; costs: DayCosts };
  meals: Record<MealType, { mother: number; child: number }>;
  purchase: Record<'egg' | 'veg' | 'potato' | 'chatu', { quantity: number; rate: number; cost: number }>;
  purchaseTotal: number;
  opening: StockQuantities;
  closing: StockQuantities;
  receipts: StockReceipt[];
  enrolled: { pregnant: number; nursing: number; childUnder3: number; child3to6: number };
  beneficiaryDays: number;
  fuel: FuelLine[];
  fuelTotal: number;
}

function sumCounts(rows: readonly DayRow[]): DayCounts {
  const t = emptyCounts();
  for (const r of rows) {
    const c = r.counts;
    for (const [k, v] of Object.entries(c.byCategory)) t.byCategory[k] = (t.byCategory[k] ?? 0) + v;
    t.pregnant += c.pregnant;
    t.nursing += c.nursing;
    t.mothers += c.mothers;
    t.children += c.children;
    t.total += c.total;
    t.childUnder3 += c.childUnder3;
    t.child3to6 += c.child3to6;
    for (const band of STOCK_AGE_BANDS) {
      t.bands[band.key].M += c.bands[band.key].M;
      t.bands[band.key].F += c.bands[band.key].F;
    }
  }
  return t;
}

function sumRations(rows: readonly DayRow[]): Ration {
  const t: Ration = {
    mother: { rice: 0, dal: 0, oil: 0, salt: 0, egg: 0, veg: 0, potato: 0, chatu: 0 },
    child: { rice: 0, dal: 0, oil: 0, salt: 0, egg: 0, veg: 0, potato: 0, chatu: 0 },
    total: { rice: 0, dal: 0, oil: 0, salt: 0, egg: 0, veg: 0, potato: 0, chatu: 0 },
  };
  for (const r of rows) {
    for (const part of ['mother', 'child', 'total'] as const) {
      for (const item of ITEM_KEYS) t[part][item] = round2(t[part][item] + r.ration[part][item]);
    }
  }
  return t;
}

function sumCosts(rows: readonly DayRow[]): DayCosts {
  const t: DayCosts = { motherVeg: 0, motherPotato: 0, chatu: 0, egg: 0, childVeg: 0, childPotato: 0, total: 0 };
  for (const r of rows) {
    for (const k of Object.keys(t) as (keyof DayCosts)[]) t[k] = round2(t[k] + r.costs[k]);
  }
  return t;
}

interface Context {
  data: AppData;
  beneficiaryMap: Map<string, Beneficiary>;
  dayMap: Map<string, DayRecord>;
  categories: Category[];
}

function makeContext(data: AppData): Context {
  return {
    data,
    beneficiaryMap: new Map(data.beneficiaries.map((b) => [b.id, b])),
    dayMap: new Map(data.days.map((d) => [d.date, d])),
    categories: [...data.categories].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

function buildRows(month: string, ctx: Context): DayRow[] {
  const { settings, receipts } = ctx.data;
  return monthDates(month).map((date, i) => {
    const record = ctx.dayMap.get(date);
    const status = resolveDayStatus(date, record, settings);
    const working = status.kind === 'working' && record !== undefined;
    const counts = working
      ? countPresent(record.presentIds, date, ctx.beneficiaryMap, ctx.categories, settings.nursingMonths)
      : emptyCounts();
    const meal = working ? record.meal : undefined;
    const ration = dayRation(meal ?? 'khichuri', meal ? counts.byCategory : {}, ctx.categories);
    const dayReceipts = zeroStock();
    for (const r of receipts) if (r.date === date) dayReceipts[r.item] += r.quantity;
    const consumption = zeroStock();
    for (const item of STOCK_ITEM_KEYS) consumption[item] = ration.total[item];
    return {
      date,
      day: i + 1,
      status,
      meal,
      served: working && counts.total > 0,
      submitted: submissionState(record) === 'submitted',
      counts,
      ration,
      costs: dayCosts(ration, settings.rates),
      receipts: dayReceipts,
      consumption,
      closing: zeroStock(),
    };
  });
}

function applyOpeningOverride(balance: StockQuantities, meta: MonthMeta | undefined): StockQuantities {
  const result = { ...balance };
  for (const item of STOCK_ITEM_KEYS) {
    const v = meta?.openingStock?.[item];
    if (v !== undefined && v !== null && !Number.isNaN(v)) result[item] = v;
  }
  return result;
}

/** Fills each row's running closing balance and returns the month-end closing. */
function runLedger(rows: DayRow[], opening: StockQuantities): StockQuantities {
  let balance = { ...opening };
  for (const row of rows) {
    const next = zeroStock();
    for (const item of STOCK_ITEM_KEYS) {
      next[item] = round2(balance[item] + row.receipts[item] - row.consumption[item]);
    }
    row.closing = next;
    balance = next;
  }
  return balance;
}

function earliestDataMonth(data: AppData): string | undefined {
  const months = [
    ...data.days.map((d) => monthOf(d.date)),
    ...data.receipts.map((r) => monthOf(r.date)),
    ...data.monthMetas.map((m) => m.month),
  ].sort();
  return months[0];
}

/** Opening balance carries forward from the earliest month with data unless a month overrides it. */
export function openingStockFor(month: string, data: AppData, ctx: Context = makeContext(data)): StockQuantities {
  const metaMap = new Map(data.monthMetas.map((m) => [m.month, m]));
  const earliest = earliestDataMonth(data);
  let balance = zeroStock();
  if (earliest && earliest < month) {
    for (let m = earliest; m < month; m = shiftMonth(m, 1)) {
      balance = applyOpeningOverride(balance, metaMap.get(m));
      balance = runLedger(buildRows(m, ctx), balance);
    }
  }
  return applyOpeningOverride(balance, metaMap.get(month));
}

function enrolledAt(date: string, ctx: Context): MonthSummary['enrolled'] {
  const e = { pregnant: 0, nursing: 0, childUnder3: 0, child3to6: 0 };
  for (const b of ctx.data.beneficiaries) {
    const cat = resolveCategory(b, date, ctx.categories, ctx.data.settings.nursingMonths);
    if (!cat) continue;
    if (b.kind === 'mother') {
      if (cat.motherStage === 'nursing') e.nursing += 1;
      else e.pregnant += 1;
      continue;
    }
    const age = ageInMonths(b.dob, date);
    if (age >= 6 && age < 36) e.childUnder3 += 1;
    else if (age >= 36 && age < 72) e.child3to6 += 1;
  }
  return e;
}

function fuelLines(month: string, beneficiaryDays: number, ctx: Context): FuelLine[] {
  const meta = ctx.data.monthMetas.find((m) => m.month === month);
  return ctx.data.settings.fuelItems.map((item) => {
    const o = meta?.fuelOverrides?.find((x) => x.fuelItemId === item.id);
    const quantity = o?.quantity ?? round2(item.qtyPerBeneficiaryDay * beneficiaryDays);
    const rate = o?.rate ?? item.rate;
    return { id: item.id, name: item.name, unit: item.unit, quantity, rate, amount: round2(quantity * rate) };
  });
}

export function buildMonthSummary(month: string, data: AppData): MonthSummary {
  const ctx = makeContext(data);
  const rows = buildRows(month, ctx);
  const opening = openingStockFor(month, data, ctx);
  const closing = runLedger(rows, opening);
  const served = rows.filter((r) => r.served);
  const totals = { counts: sumCounts(rows), ration: sumRations(rows), costs: sumCosts(rows) };

  const meals = Object.fromEntries(MEAL_TYPES.map((m) => [m, { mother: 0, child: 0 }])) as MonthSummary['meals'];
  for (const r of served) {
    meals[r.meal!].mother += r.counts.mothers;
    meals[r.meal!].child += r.counts.children;
  }

  const { rates } = data.settings;
  const purchaseLine = (quantity: number, rate: number, perUnit: number) => ({
    quantity,
    rate,
    cost: round2(quantity * perUnit),
  });
  const purchase = {
    egg: purchaseLine(totals.ration.total.egg, rates.egg, rates.egg),
    veg: purchaseLine(totals.ration.total.veg, rates.veg, rates.veg / 1000),
    potato: purchaseLine(totals.ration.total.potato, rates.potato, rates.potato / 1000),
    chatu: purchaseLine(totals.ration.total.chatu, rates.chatu, rates.chatu / 1000),
  };
  const purchaseTotal = round2(purchase.egg.cost + purchase.veg.cost + purchase.potato.cost + purchase.chatu.cost);
  const lastDate = lastDateOfMonth(month);
  const fuel = fuelLines(month, totals.counts.total, ctx);

  return {
    month,
    rows,
    servedDays: served.length,
    firstDate: `${month}-01`,
    lastDate,
    totals,
    meals,
    purchase,
    purchaseTotal,
    opening,
    closing,
    receipts: data.receipts.filter((r) => monthOf(r.date) === month).sort((a, b) => (a.date < b.date ? -1 : 1)),
    enrolled: enrolledAt(lastDate, ctx),
    beneficiaryDays: totals.counts.total,
    fuel,
    fuelTotal: round2(fuel.reduce((s, f) => s + f.amount, 0)),
  };
}
