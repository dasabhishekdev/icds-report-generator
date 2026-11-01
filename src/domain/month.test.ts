import { describe, expect, it } from 'vitest';
import { sampleData } from '../db/sampleData';
import { buildMonthSummary, buildPeriodSummary, submissionState, suggestMeal } from './month';

describe('September 2026 sample (AWC 547)', () => {
  const summary = buildMonthSummary('2026-09', sampleData());

  it('counts cooking days and meals like the nutrition voucher', () => {
    expect(summary.servedDays).toBe(27);
    expect(summary.meals.khichuri).toEqual({ mother: 55, child: 511 });
    expect(summary.meals.rice).toEqual({ mother: 52, child: 471 });
  });

  it('computes eggs, vegetables, potato and chatu quantities', () => {
    expect(summary.totals.ration.mother.egg).toBe(107);
    expect(summary.totals.ration.child.egg).toBe(726.5);
    expect(summary.purchase.egg.quantity).toBe(833.5);
    expect(summary.purchase.veg.quantity).toBe(11108);
    expect(summary.purchase.potato.quantity).toBe(34970);
    expect(summary.purchase.chatu.quantity).toBe(4710);
  });

  it('prices the voucher exactly', () => {
    expect(summary.purchase.egg.cost).toBe(7084.75);
    expect(summary.purchase.veg.cost).toBe(222.16);
    expect(summary.purchase.potato.cost).toBe(979.16);
    expect(summary.purchase.chatu.cost).toBe(786.57);
    expect(summary.purchaseTotal).toBe(9072.64);
    expect(summary.totals.costs.total).toBe(9072.64);
  });

  it('reproduces SNP register day rows', () => {
    const day1 = summary.rows[0].costs;
    expect(day1).toMatchObject({ motherVeg: 0.69, motherPotato: 4.2, egg: 182.75, childVeg: 15.17, childPotato: 62.16 });
    const day2 = summary.rows[1].costs;
    expect(day2).toMatchObject({ motherPotato: 2.52, chatu: 61.79, egg: 340, childVeg: 0, childPotato: 0 });
  });

  it('reproduces the stock register ledger', () => {
    expect(summary.rows[0].consumption).toMatchObject({ rice: 3000, dal: 1200, oil: 80, salt: 80 });
    expect(summary.rows[1].consumption).toMatchObject({ rice: 2180, dal: 0 });
    expect(summary.rows[15].closing.dal).toBe(34410);
    expect(summary.closing).toEqual({ rice: 267310, dal: 25800, oil: 5716, salt: 6076 });
  });

  it('keeps chatu out of the stock ledger because it is bought', () => {
    expect(summary.rows[1].consumption).not.toHaveProperty('chatu');
    const legacy = sampleData();
    legacy.receipts.push({ id: 'old-chatu', date: '2026-09-01', item: 'chatu' as never, quantity: 10000 });
    const withLegacy = buildMonthSummary('2026-09', legacy);
    expect(withLegacy.closing).toEqual(summary.closing);
    expect(withLegacy.receipts).toHaveLength(3);
  });

  it('counts everyone on the register, including children who never came', () => {
    expect(summary.enrolled).toEqual({ pregnant: 3, nursing: 2, childUnder3: 16, child3to6: 25 });
  });

  it('bills fuel per cooking day like the fuel register', () => {
    expect(summary.rows[0].fuel).toBe(43.95);
    expect(summary.rows[5].fuel).toBe(0);
    expect(summary.fuelDaily).toEqual({ rate: 43.95, days: 27, amount: 1186.65 });
    expect(summary.fuelTotal).toBe(1186.65);
  });

  it('marks Sundays as holidays', () => {
    expect(summary.rows[5].status).toMatchObject({ kind: 'holiday', isWeeklyOff: true });
    expect(summary.rows[5].served).toBe(false);
  });

  it('carries closing stock into the next month', () => {
    const october = buildMonthSummary('2026-10', sampleData());
    expect(october.opening).toMatchObject({ rice: 267310, dal: 25800, oil: 5716, salt: 6076 });
  });
});

describe('editing an older submitted day', () => {
  it('recalculates the month and marks the day as changed', () => {
    const data = sampleData();
    const day5 = data.days.find((d) => d.date === '2026-09-05')!;
    expect(submissionState(day5)).toBe('submitted');

    const childId = day5.presentIds.find((id) => id.startsWith('demo-c-'))!;
    day5.presentIds = day5.presentIds.filter((id) => id !== childId);
    day5.updatedAt = day5.submittedAt! + 1;

    const summary = buildMonthSummary('2026-09', data);
    expect(submissionState(day5)).toBe('changed');
    expect(summary.rows[4].counts.children).toBe(36);
    expect(summary.meals.khichuri.child).toBe(510);
    expect(summary.purchase.egg.quantity).toBe(833);
    expect(summary.rows[4].submitted).toBe(false);
  });
});

describe('suggestMeal', () => {
  it('alternates from the previous working day', () => {
    const days = sampleData().days;
    expect(suggestMeal('2026-09-01', days)).toBe('khichuri');
    expect(suggestMeal('2026-10-01', days)).toBe('khichuri');
    expect(suggestMeal('2026-09-30', days)).toBe('rice');
  });
});

describe('buildPeriodSummary', () => {
  const data = sampleData();

  it('equals the month summary for a whole month', () => {
    const range = buildPeriodSummary('2026-09-01', '2026-09-30', data);
    expect(range.period).toMatchObject({ fullMonth: true, singleMonth: true });
    expect(range.purchaseTotal).toBe(buildMonthSummary('2026-09', data).purchaseTotal);
  });

  it('starts the stock at the balance carried to the first day of the range', () => {
    const month = buildMonthSummary('2026-09', data);
    const range = buildPeriodSummary('2026-09-07', '2026-09-12', data);
    expect(range.period.fullMonth).toBe(false);
    expect(range.rows.map((r) => r.day)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(range.opening).toEqual(month.rows[5].closing);
    expect(range.closing).toEqual(month.rows[11].closing);
    expect(range.servedDays).toBe(6);
  });

  it('spans two months', () => {
    const range = buildPeriodSummary('2026-09-28', '2026-10-03', data);
    expect(range.period.singleMonth).toBe(false);
    expect(range.rows.map((r) => r.date)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(range.servedDays).toBe(3);
  });
});
