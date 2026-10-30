import type { Category, CenterInfo, ItemQuantities, Norms, Settings } from './schema';

const zero: ItemQuantities = { rice: 0, dal: 0, oil: 0, salt: 0, egg: 0, veg: 0, potato: 0, chatu: 0 };

export function emptyNorms(): Norms {
  return { khichuri: { ...zero }, rice: { ...zero } };
}

/** Per-head norms reverse-engineered from the September 2026 registers of AWC 547. */
const motherNorms: Norms = {
  khichuri: { rice: 75, dal: 30, oil: 2, salt: 2, egg: 1, veg: 11.5, potato: 50, chatu: 0 },
  rice: { rice: 110, dal: 0, oil: 2, salt: 2, egg: 1, veg: 0, potato: 30, chatu: 0 },
};

const childNorms: Norms = {
  khichuri: { rice: 75, dal: 30, oil: 2, salt: 2, egg: 0.5, veg: 20.5, potato: 60, chatu: 0 },
  rice: { rice: 50, dal: 0, oil: 2, salt: 2, egg: 1, veg: 0, potato: 0, chatu: 10 },
};

const cloneNorms = (n: Norms): Norms => ({ khichuri: { ...n.khichuri }, rice: { ...n.rice } });

export function defaultCategories(): Category[] {
  return [
    { id: 'pregnant', name: 'গর্ভবতী (Pregnant)', group: 'mother', motherStage: 'pregnant', servesMeal: true, sortOrder: 1, norms: cloneNorms(motherNorms) },
    { id: 'nursing', name: 'প্রসূতি (Nursing)', group: 'mother', motherStage: 'nursing', servesMeal: true, sortOrder: 2, norms: cloneNorms(motherNorms) },
    { id: 'child-0-6m', name: 'শিশু ০-৬ মাস', group: 'child', minMonths: 0, maxMonths: 6, servesMeal: false, sortOrder: 3, norms: emptyNorms() },
    { id: 'child-6m-3y', name: 'শিশু ৬ মাস - ৩ বছর', group: 'child', minMonths: 6, maxMonths: 36, servesMeal: true, sortOrder: 4, norms: cloneNorms(childNorms) },
    { id: 'child-3y-6y', name: 'শিশু ৩ - ৬ বছর', group: 'child', minMonths: 36, maxMonths: 72, servesMeal: true, sortOrder: 5, norms: cloneNorms(childNorms) },
  ];
}

export function emptyCenter(): CenterInfo {
  return {
    name: '',
    number: '',
    code: '',
    gramPanchayat: '',
    project: '',
    district: '',
    workerName: '',
    vegShopkeeper: '',
    fuelShopkeeper: '',
  };
}

/** AWC 547 — the centre whose September 2026 registers the defaults were derived from. */
export const SAMPLE_CENTER: CenterInfo = {
  name: 'Balta Tangakure',
  number: '547',
  code: '19337201026',
  gramPanchayat: 'Palla',
  project: 'বনগাঁ গ্রামীণ',
  district: 'উত্তর ২৪ পরগণা',
  workerName: 'Swapna Das Sikdar',
  vegShopkeeper: 'অমিত বিশ্বাস (Amit Biswas)',
  fuelShopkeeper: 'রমেন বিশ্বাস (Ramen Biswas)',
};

/** Defaults every new account starts with; only the centre details are the user's own. */
export function defaultSettings(center: Partial<CenterInfo> = {}): Settings {
  return {
    id: 'settings',
    language: 'bn',
    center: { ...emptyCenter(), ...center },
    rates: { egg: 8.5, veg: 20, potato: 28, chatu: 167 },
    nursingMonths: 6,
    weeklyOffDays: [0],
    fuelItems: [
      { id: 'fuel', name: 'কয়লা/কাঠ/কেরোসিন তেল (Coal/Wood/Kerosene)', unit: 'Kg', rate: 0, qtyPerBeneficiaryDay: 0 },
      { id: 'matchbox', name: 'ঘুঁটে / দেশলাই (Cowdung cake / Matchbox)', unit: 'Pcs', rate: 0, qtyPerBeneficiaryDay: 0 },
      { id: 'csb', name: 'সি.এস.বি. / চাল / ডাল (CSB / Rice / Dal)', unit: 'Kg', rate: 0, qtyPerBeneficiaryDay: 0 },
      { id: 'oil', name: 'স্যাঃ তেল / সঃ তেল (Oil)', unit: 'Lit', rate: 0, qtyPerBeneficiaryDay: 0 },
      { id: 'spices', name: 'হলুদ / লবণ (Turmeric / Salt)', unit: 'Kg', rate: 0, qtyPerBeneficiaryDay: 0 },
    ],
    holidays: [],
    paperSize: 'A4',
  };
}
