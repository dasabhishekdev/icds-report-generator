import type { Beneficiary, ChildBeneficiary, DayRecord, Gender, MonthMeta, Settings, StockReceipt } from './schema';
import { defaultCategories, defaultSettings } from './defaults';
import type { AppData } from '../domain/month';

/**
 * Attendance of AWC 547 for September 2026, transcribed from the stock register:
 * [day, meal, pregnant, nursing, then M/F counts for 7M-1Y, 1Y-2Y, 2Y-3Y, 3Y-5Y, 5Y-6Y].
 */
const SEPTEMBER_2026: [number, 'K' | 'R', ...number[]][] = [
  [1, 'K', 1, 2, 1, 2, 3, 4, 2, 3, 5, 8, 4, 5],
  [2, 'R', 1, 2, 1, 2, 3, 4, 2, 3, 5, 8, 4, 5],
  [3, 'K', 1, 2, 1, 2, 3, 4, 2, 3, 5, 8, 4, 5],
  [4, 'R', 1, 2, 1, 2, 3, 4, 2, 3, 5, 8, 4, 5],
  [5, 'K', 1, 2, 1, 2, 3, 4, 2, 3, 5, 8, 4, 5],
  [7, 'R', 2, 2, 1, 2, 3, 4, 2, 3, 4, 8, 4, 5],
  [8, 'K', 2, 2, 1, 2, 3, 4, 2, 3, 4, 8, 4, 5],
  [9, 'R', 2, 2, 1, 2, 3, 4, 2, 3, 4, 8, 4, 5],
  [10, 'K', 2, 2, 1, 2, 3, 3, 2, 3, 5, 8, 4, 5],
  [11, 'R', 2, 2, 1, 2, 3, 3, 2, 3, 5, 8, 4, 5],
  [12, 'K', 2, 2, 1, 2, 3, 3, 2, 3, 5, 8, 4, 5],
  [14, 'R', 2, 2, 1, 2, 3, 4, 2, 3, 5, 7, 4, 5],
  [15, 'K', 2, 2, 1, 2, 3, 3, 2, 3, 5, 7, 4, 5],
  [16, 'R', 3, 2, 1, 2, 2, 4, 2, 3, 4, 6, 4, 4],
  [17, 'K', 3, 2, 1, 2, 2, 4, 2, 3, 4, 8, 4, 4],
  [18, 'R', 3, 2, 1, 2, 3, 4, 2, 3, 4, 7, 4, 5],
  [19, 'K', 3, 2, 1, 2, 3, 4, 2, 3, 5, 7, 4, 5],
  [21, 'R', 3, 1, 2, 2, 3, 4, 2, 3, 5, 8, 3, 4],
  [22, 'K', 3, 1, 2, 2, 3, 4, 2, 3, 5, 8, 3, 4],
  [23, 'R', 3, 1, 2, 2, 3, 4, 2, 3, 5, 8, 4, 4],
  [24, 'K', 3, 1, 2, 2, 3, 4, 2, 3, 5, 8, 4, 4],
  [25, 'R', 3, 1, 2, 2, 3, 4, 2, 3, 5, 8, 4, 4],
  [26, 'K', 3, 1, 2, 2, 3, 4, 2, 3, 5, 8, 4, 5],
  [27, 'K', 3, 1, 2, 2, 3, 4, 2, 3, 5, 8, 4, 5],
  [28, 'R', 3, 1, 2, 2, 3, 4, 2, 3, 5, 8, 4, 5],
  [29, 'K', 3, 1, 2, 2, 3, 4, 2, 3, 5, 8, 4, 5],
  [30, 'R', 3, 1, 2, 2, 3, 4, 2, 3, 5, 8, 4, 5],
];

/** Birth dates that keep each child inside its age band for the whole of September 2026. */
const BAND_DOB = ['2026-01-15', '2025-03-15', '2024-03-15', '2022-03-15', '2021-01-15'];

const BOY_NAMES = ['Rahul', 'Sourav', 'Arijit', 'Tanmoy', 'Ritam', 'Subho', 'Ayan', 'Rohan', 'Debjit', 'Pritam', 'Sayan', 'Rajib', 'Bapi', 'Niloy', 'Amit', 'Joy'];
const GIRL_NAMES = ['Puja', 'Riya', 'Mitali', 'Payel', 'Ankita', 'Sneha', 'Tania', 'Moumita', 'Rupa', 'Priya', 'Soma', 'Jhuma', 'Keya', 'Rimpa', 'Barsha', 'Dipa', 'Lipika', 'Mou', 'Sathi', 'Tumpa', 'Nupur', 'Shreya'];

export function sampleData(): AppData {
  const settings: Settings = {
    ...defaultSettings(),
    holidays: [
      { date: '2026-10-19', name: 'অষ্টমী (Astami)' },
      { date: '2026-10-20', name: 'নবমী (Nabami)' },
      { date: '2026-10-21', name: 'দশমী (Dashami)' },
    ],
  };
  const beneficiaries: Beneficiary[] = [];
  const pregnantIds = ['Mampi Das', 'Sima Mondal', 'Rina Biswas'].map((name, i) => {
    const id = `demo-p-${i + 1}`;
    beneficiaries.push({ id, kind: 'mother', name, enrolledOn: '2026-08-01', expectedDeliveryDate: '2027-01-10' });
    return id;
  });
  const nursingIds = ['Lakshmi Sarkar', 'Anita Ghosh'].map((name, i) => {
    const id = `demo-n-${i + 1}`;
    beneficiaries.push({ id, kind: 'mother', name, enrolledOn: '2026-01-01', deliveryDate: '2026-07-01' });
    return id;
  });

  // Pool of children per [band][gender] sized to the busiest day.
  const pool: string[][][] = BAND_DOB.map(() => [[], []]);
  let boy = 0;
  let girl = 0;
  BAND_DOB.forEach((dob, band) => {
    (['M', 'F'] as Gender[]).forEach((gender, g) => {
      const max = Math.max(...SEPTEMBER_2026.map((row) => row[4 + band * 2 + g] as number));
      for (let k = 0; k < max; k++) {
        const name = gender === 'M' ? BOY_NAMES[boy++ % BOY_NAMES.length] : GIRL_NAMES[girl++ % GIRL_NAMES.length];
        const child: ChildBeneficiary = {
          id: `demo-c-${band}-${gender}-${k}`,
          kind: 'child',
          name: `${name} ${['Das', 'Mondal', 'Biswas', 'Sarkar'][k % 4]}`,
          gender,
          dob,
          enrolledOn: '2026-08-01',
        };
        beneficiaries.push(child);
        pool[band][g].push(child.id);
      }
    });
  });

  const days: DayRecord[] = SEPTEMBER_2026.map(([day, meal, pregnant, nursing, ...bands]) => {
    const present = [...pregnantIds.slice(0, pregnant as number), ...nursingIds.slice(0, nursing as number)];
    bands.forEach((n, idx) => present.push(...pool[Math.floor(idx / 2)][idx % 2].slice(0, n)));
    const date = `2026-09-${String(day).padStart(2, '0')}`;
    return {
      date,
      status: 'working',
      meal: meal === 'K' ? 'khichuri' : 'rice',
      presentIds: present,
      updatedAt: 0,
      submittedAt: new Date(`${date}T12:30:00`).getTime(),
    };
  });

  const receipts: StockReceipt[] = [
    { id: 'demo-r-1', date: '2026-09-16', item: 'dal', quantity: 30000, challanNo: '1429' },
    { id: 'demo-r-2', date: '2026-09-16', item: 'oil', quantity: 3000, challanNo: '1429' },
    { id: 'demo-r-3', date: '2026-09-16', item: 'salt', quantity: 3000, challanNo: '1429' },
    { id: 'demo-r-4', date: '2026-09-01', item: 'chatu', quantity: 10000, challanNo: '1388' },
  ];

  const monthMetas: MonthMeta[] = [
    { month: '2026-09', openingStock: { chatu: 0, rice: 339030, dal: 12780, oil: 4894, salt: 5254 } },
  ];

  return { settings, categories: defaultCategories(), beneficiaries, days, receipts, monthMetas };
}
