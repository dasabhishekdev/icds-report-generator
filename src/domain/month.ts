import {
  ITEM_KEYS,
  MEAL_TYPES,
  STOCK_ITEM_KEYS,
  isStockItem,
  type Beneficiary,
  type Category,
  type DayRecord,
  type MealType,
  type MonthMeta,
  type PurchasedItemKey,
  type Settings,
  type StockItemKey,
  type StockReceipt,
} from '../db/schema';
import { addDays, ageGroupMonths, dateRange, lastDateOfMonth, monthDates, monthOf, parseIso, shiftMonth, weekday } from './dates';
import { resolveCategory } from './eligibility';
import { calendarHolidayOn, type HolidayCalendar } from './holidays';
import {
  countPresent,
  dayCosts,
  dayRation,
  emptyCounts,
  itemCost,
  rateGramsFor,
  round2,
  STOCK_AGE_BANDS,
  zeroItems,
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
  /** West Bengal Government holiday lists by year; shared by every account and not part of backups. */
  holidayCalendars?: HolidayCalendar[];
}

export type DayKind = 'working' | 'holiday' | 'unrecorded';

export interface DayStatus {
  kind: DayKind;
  /** Holiday name (festival) – empty for a plain weekly off. */
  label?: string;
  isWeeklyOff: boolean;
  /** Set when the holiday comes from the calendar rather than a saved day. */
  holidaySource?: 'custom' | 'state';
}

export function resolveDayStatus(
  date: string,
  record: DayRecord | undefined,
  settings: Settings,
  calendars: readonly HolidayCalendar[] = [],
): DayStatus {
  const isWeeklyOff = settings.weeklyOffDays.includes(weekday(date));
  if (record) {
    return record.status === 'working'
      ? { kind: 'working', isWeeklyOff }
      : { kind: 'holiday', label: record.holidayReason, isWeeklyOff };
  }
  const holiday = calendarHolidayOn(date, settings, calendars);
  if (holiday) return { kind: 'holiday', label: holiday.name, isWeeklyOff, holidaySource: holiday.source };
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
const zeroStock = (): StockQuantities => Object.fromEntries(STOCK_ITEM_KEYS.map((k) => [k, 0])) as StockQuantities;

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
  /** Fuel & spice amount for the day (Rs); zero unless a meal was cooked. */
  fuel: number;
  receipts: StockQuantities;
  consumption: StockQuantities;
  closing: StockQuantities;
}

/** A row of the fuel register's item table: the daily fuel bill, or a government supply used. */
export interface FuelLine {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  /** Government supply: the quantity used from the stock ledger, with no rate or amount. */
  govSupplied: boolean;
}

/** Government supplies listed on the printed fuel register, with the stock items they add up. */
const FUEL_REGISTER_SUPPLIES: { id: string; name: string; unit: string; items: StockItemKey[] }[] = [
  { id: 'csb', name: 'সি.এস.বি. / চাল / ডাল (CSB / Rice / Dal)', unit: 'গ্রাম', items: ['rice', 'dal'] },
  { id: 'oil', name: 'স্যাঃ তেল / সঃ তেল (Oil)', unit: 'গ্রাম', items: ['oil'] },
  { id: 'salt', name: 'লবণ (Salt)', unit: 'গ্রাম', items: ['salt'] },
];

export interface ReportPeriod {
  from: string;
  to: string;
  /** Exactly one calendar month (1st to last day). */
  fullMonth: boolean;
  /** Both ends in the same calendar month. */
  singleMonth: boolean;
}

export interface MonthSummary {
  /** Month of the period start; used for month-level settings and grouping. */
  month: string;
  period: ReportPeriod;
  rows: DayRow[];
  servedDays: number;
  firstDate: string;
  lastDate: string;
  totals: { counts: DayCounts; ration: Ration; costs: DayCosts };
  meals: Record<MealType, { mother: number; child: number }>;
  /** `rate` is Rs for `per` pieces (egg) or grams. */
  purchase: Record<PurchasedItemKey, { quantity: number; rate: number; per: number; cost: number }>;
  purchaseTotal: number;
  opening: StockQuantities;
  closing: StockQuantities;
  receipts: StockReceipt[];
  enrolled: { pregnant: number; nursing: number; childUnder3: number; child3to6: number };
  beneficiaryDays: number;
  fuel: FuelLine[];
  /** Rs per cooking day × cooking days, shown row by row on the fuel register. */
  fuelDaily: { rate: number; days: number; amount: number };
  /** The fuel & spice bill: the daily amount (government supplies carry no money). */
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
    mother: zeroItems(),
    child: zeroItems(),
    total: zeroItems(),
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

function buildRows(dates: readonly string[], ctx: Context): DayRow[] {
  const { settings, receipts } = ctx.data;
  return dates.map((date) => {
    const record = ctx.dayMap.get(date);
    const status = resolveDayStatus(date, record, settings, ctx.data.holidayCalendars);
    const working = status.kind === 'working' && record !== undefined;
    const counts = working
      ? countPresent(record.presentIds, date, ctx.beneficiaryMap, ctx.categories, settings.nursingMonths)
      : emptyCounts();
    const meal = working ? record.meal : undefined;
    const served = working && counts.total > 0;
    const ration = dayRation(meal ?? 'khichuri', meal ? counts.byCategory : {}, ctx.categories);
    const dayReceipts = zeroStock();
    for (const r of receipts) if (r.date === date && isStockItem(r.item)) dayReceipts[r.item] += r.quantity;
    const consumption = zeroStock();
    for (const item of STOCK_ITEM_KEYS) consumption[item] = ration.total[item];
    return {
      date,
      day: parseIso(date).d,
      status,
      meal,
      served,
      submitted: submissionState(record) === 'submitted',
      counts,
      ration,
      costs: dayCosts(ration, settings),
      fuel: served ? (settings.fuelPerCookingDay ?? 0) : 0,
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
      balance = runLedger(buildRows(monthDates(m), ctx), balance);
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
    if (!b.dob) continue;
    const age = ageGroupMonths(b.dob, date);
    if (age >= 6 && age < 36) e.childUnder3 += 1;
    else if (age >= 36 && age < 72) e.child3to6 += 1;
  }
  return e;
}

/** Stock in hand at the start of `date`: the month's opening plus movements on earlier days of that month. */
function openingStockAt(date: string, ctx: Context): StockQuantities {
  const month = monthOf(date);
  const monthOpening = openingStockFor(month, ctx.data, ctx);
  const earlier = dateRange(`${month}-01`, addDays(date, -1));
  return runLedger(buildRows(earlier, ctx), monthOpening);
}

/** The fuel register's item rows: the daily bill, then each government supply used in the period. */
function fuelLines(rows: readonly DayRow[], daily: MonthSummary['fuelDaily']): FuelLine[] {
  const used = (item: StockItemKey) => rows.reduce((s, r) => s + r.consumption[item], 0);
  return [
    { id: 'fuel', name: 'জ্বালানী ও মশলা (Fuel & Spices)', unit: 'দিন', quantity: daily.days, rate: daily.rate, amount: daily.amount, govSupplied: false },
    ...FUEL_REGISTER_SUPPLIES.map((supply) => ({
      id: supply.id,
      name: supply.name,
      unit: supply.unit,
      quantity: round2(supply.items.reduce((s, item) => s + used(item), 0)),
      rate: 0,
      amount: 0,
      govSupplied: true,
    })),
  ];
}

export function buildMonthSummary(month: string, data: AppData): MonthSummary {
  return buildPeriodSummary(`${month}-01`, lastDateOfMonth(month), data);
}

/** Summary for any inclusive date range; a whole month is the usual case. */
export function buildPeriodSummary(from: string, to: string, data: AppData): MonthSummary {
  if (to < from) throw new Error('End date is before start date');
  const ctx = makeContext(data);
  const month = monthOf(from);
  const singleMonth = monthOf(to) === month;
  const period: ReportPeriod = { from, to, singleMonth, fullMonth: singleMonth && from === `${month}-01` && to === lastDateOfMonth(month) };
  const rows = buildRows(dateRange(from, to), ctx);
  const opening = period.fullMonth ? openingStockFor(month, data, ctx) : openingStockAt(from, ctx);
  const closing = runLedger(rows, opening);
  const served = rows.filter((r) => r.served);
  const totals = { counts: sumCounts(rows), ration: sumRations(rows), costs: sumCosts(rows) };

  const meals = Object.fromEntries(MEAL_TYPES.map((m) => [m, { mother: 0, child: 0 }])) as MonthSummary['meals'];
  for (const r of served) {
    meals[r.meal!].mother += r.counts.mothers;
    meals[r.meal!].child += r.counts.children;
  }

  const pricing = data.settings;
  const purchaseLine = (item: PurchasedItemKey) => {
    const quantity = totals.ration.total[item];
    return {
      quantity,
      rate: pricing.rates[item],
      /** Pieces (egg) or grams the rate is for. */
      per: item === 'egg' ? 1 : rateGramsFor(pricing, item),
      cost: itemCost(item, quantity, pricing),
    };
  };
  const purchase = {
    egg: purchaseLine('egg'),
    veg: purchaseLine('veg'),
    potato: purchaseLine('potato'),
    chatu: purchaseLine('chatu'),
  };
  const purchaseTotal = round2(purchase.egg.cost + purchase.veg.cost + purchase.potato.cost + purchase.chatu.cost);
  const fuelRate = data.settings.fuelPerCookingDay ?? 0;
  const fuelDaily = { rate: fuelRate, days: served.length, amount: round2(fuelRate * served.length) };
  const fuel = fuelLines(rows, fuelDaily);

  return {
    month,
    period,
    rows,
    servedDays: served.length,
    firstDate: from,
    lastDate: to,
    totals,
    meals,
    purchase,
    purchaseTotal,
    opening,
    closing,
    receipts: data.receipts
      .filter((r) => r.date >= from && r.date <= to && isStockItem(r.item))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    enrolled: enrolledAt(to, ctx),
    beneficiaryDays: totals.counts.total,
    fuel,
    fuelDaily,
    fuelTotal: fuelDaily.amount,
  };
}
