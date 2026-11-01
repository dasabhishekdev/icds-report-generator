export type MealType = 'khichuri' | 'rice';
export const MEAL_TYPES: readonly MealType[] = ['khichuri', 'rice'];

/** Everything that is allotted per head. Quantities are grams, except egg which is pieces. */
export type ItemKey = 'rice' | 'dal' | 'oil' | 'salt' | 'turmeric' | 'egg' | 'veg' | 'potato' | 'chatu';
export const ITEM_KEYS: readonly ItemKey[] = ['rice', 'dal', 'oil', 'salt', 'turmeric', 'egg', 'veg', 'potato', 'chatu'];

/** Items supplied by the government (no rate) and carried as a balance in the stock register (grams). */
export type StockItemKey = 'rice' | 'dal' | 'oil' | 'salt' | 'turmeric';
export const STOCK_ITEM_KEYS: readonly StockItemKey[] = ['rice', 'dal', 'oil', 'salt', 'turmeric'];
export const isStockItem = (item: string): item is StockItemKey => (STOCK_ITEM_KEYS as readonly string[]).includes(item);

/** Items bought from the shop and paid for through the nutrition voucher. */
export type PurchasedItemKey = 'egg' | 'veg' | 'potato' | 'chatu';
export const PURCHASED_ITEM_KEYS: readonly PurchasedItemKey[] = ['egg', 'veg', 'potato', 'chatu'];
/** Bought items priced by weight; egg is priced per piece. */
export type WeighedItemKey = Exclude<PurchasedItemKey, 'egg'>;
export const WEIGHED_ITEM_KEYS: readonly WeighedItemKey[] = ['veg', 'potato', 'chatu'];

export type ItemQuantities = Record<ItemKey, number>;
export type Norms = Record<MealType, ItemQuantities>;

export type Gender = 'M' | 'F';
export type CategoryGroup = 'mother' | 'child';
export type MotherStage = 'pregnant' | 'nursing';

export interface Category {
  id: string;
  name: string;
  group: CategoryGroup;
  /** Mother categories match on pregnancy stage. */
  motherStage?: MotherStage;
  /**
   * Child categories match on completed age in months: minMonths <= age < maxMonths, where a child
   * completes N months the day after the N-month anniversary (see `ageGroupMonths`).
   */
  minMonths?: number;
  maxMonths?: number;
  /** Beneficiaries in a category that is not served (e.g. 0-6 months) are hidden from attendance. */
  servesMeal: boolean;
  sortOrder: number;
  norms: Norms;
}

interface BeneficiaryBase {
  id: string;
  name: string;
  /** Registration date at the centre (YYYY-MM-DD). */
  enrolledOn: string;
  exitedOn?: string;
  notes?: string;
}

export interface ChildBeneficiary extends BeneficiaryBase {
  kind: 'child';
  gender: Gender;
  /** Missing until the worker records it; without it the child has no age category. */
  dob?: string;
  guardianName?: string;
}

export interface MotherBeneficiary extends BeneficiaryBase {
  kind: 'mother';
  husbandName?: string;
  expectedDeliveryDate?: string;
  /** Once set, the mother is "nursing" from this date for `nursingMonths`. */
  deliveryDate?: string;
}

export type Beneficiary = ChildBeneficiary | MotherBeneficiary;

export interface DayRecord {
  date: string;
  status: 'working' | 'holiday';
  holidayReason?: string;
  meal: MealType;
  presentIds: string[];
  updatedAt: number;
  /** Final check-in time. The day stays editable; edits after this make it "changed" until resubmitted. */
  submittedAt?: number;
}

export interface StockReceipt {
  id: string;
  date: string;
  item: StockItemKey;
  /** Grams. */
  quantity: number;
  challanNo?: string;
  note?: string;
}

/** Fuel register item rows from before they were derived automatically; kept so older data still loads. */
export interface FuelItem {
  id: string;
  name: string;
  unit: string;
  rate: number;
  /** Auto quantity for the month = this × total beneficiary-days. */
  qtyPerBeneficiaryDay: number;
  /** Supplied by the government: the quantity is shown but no rate or money applies. */
  govSupplied?: boolean;
}

/** Legacy per-month fuel item edits; no longer used. */
export interface FuelLineOverride {
  fuelItemId: string;
  quantity?: number;
  rate?: number;
}

export interface MonthMeta {
  /** YYYY-MM */
  month: string;
  openingStock?: Partial<Record<StockItemKey, number>>;
  fuelOverrides?: FuelLineOverride[];
}

export interface Holiday {
  date: string;
  name: string;
}

export interface CenterInfo {
  name: string;
  number: string;
  code: string;
  gramPanchayat: string;
  project: string;
  district: string;
  workerName: string;
  vegShopkeeper: string;
  fuelShopkeeper: string;
}

export type Language = 'bn' | 'en';
export type PaperSize = 'A4' | 'A3';
/** Which West Bengal Government holidays close the centre: List-I and List-II, List-I only, or none. */
export type StateHolidayMode = 'all' | 'public' | 'off';
export const STATE_HOLIDAY_MODES: readonly StateHolidayMode[] = ['all', 'public', 'off'];

export interface Settings {
  id: 'settings';
  language: Language;
  center: CenterInfo;
  /** Egg: Rs per piece. Vegetables, potato, chatu: Rs for `rateGrams` grams. */
  rates: Record<PurchasedItemKey, number>;
  /** Grams each weighed rate is for, as written on paper (chatu ₹1.67 for 10.44 g). Absent means per kg. */
  rateGrams?: Partial<Record<WeighedItemKey, number>>;
  nursingMonths: number;
  /** 0 = Sunday … 6 = Saturday */
  weeklyOffDays: number[];
  /** Legacy, ignored: the fuel register's item rows are derived from the daily rate and the stock ledger. */
  fuelItems?: FuelItem[];
  /** Fuel & spice bill in Rs for every day a meal is cooked. Absent in databases created before it existed. */
  fuelPerCookingDay?: number;
  /** The centre's own holidays; they apply on top of the state calendar. */
  holidays: Holiday[];
  /** Absent means 'all'. */
  stateHolidays?: StateHolidayMode;
  /** State-calendar holidays on which this centre stays open. */
  openOnStateHolidays?: string[];
  /** Paper for PDF, print and Excel page setup. Absent in databases created before it existed. */
  paperSize?: PaperSize;
  /** Legacy, ignored: the SNP register always writes money as taka and paisa. */
  snpInPaise?: boolean;
}

export interface BackupFile {
  app: 'icds-report-generator';
  version: 1;
  exportedAt: string;
  settings: Settings;
  categories: Category[];
  beneficiaries: Beneficiary[];
  days: DayRecord[];
  receipts: StockReceipt[];
  monthMetas: MonthMeta[];
}
