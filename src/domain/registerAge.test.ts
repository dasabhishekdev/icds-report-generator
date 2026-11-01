import { describe, expect, it } from 'vitest';
import { ageGroupMonths, dateRange, lastDateOfMonth, shiftMonth } from './dates';
import {
  babyAge,
  deliveryForBabyAge,
  dobForRegisterAge,
  eddForPregnancyMonth,
  exitAfterMonth,
  lastMonthBeforeExit,
  pregnancyMonth,
  registerAge,
} from './registerAge';

const months = Array.from({ length: 13 }, (_, i) => shiftMonth('2026-01', i));
const ages = [0, 1, 5, 6, 7, 11, 12, 13, 23, 24, 35, 36, 37, 59, 60, 71];

describe('register ages', () => {
  it('keeps a child at the written age for all but at most one day of the register month', () => {
    for (const month of months) {
      for (const age of ages) {
        const dob = dobForRegisterAge(age, month);
        const off = dateRange(`${month}-01`, lastDateOfMonth(month)).filter((date) => ageGroupMonths(dob, date) !== age);
        expect(off.length, `${age}m in ${month}: ${off.join(',')}`).toBeLessThanOrEqual(1);
        expect(registerAge(dob, month)).toBe(age);
      }
    }
  }, 30_000);

  it('keeps the September 2026 seed ages for the whole month', () => {
    const dob = dobForRegisterAge(35, '2026-09');
    for (const date of dateRange('2026-09-01', '2026-09-30')) expect(ageGroupMonths(dob, date)).toBe(35);
    expect(registerAge(dob, '2026-10')).toBe(36);
  });

  it('counts a nursing baby from the 1st of its birth month', () => {
    expect(deliveryForBabyAge(3, '2026-10')).toBe('2026-07-01');
    expect(deliveryForBabyAge(0, '2026-10')).toBe('2026-10-01');
    expect(babyAge('2026-07-01', '2026-10')).toBe(3);
    expect(babyAge('2026-03-20', '2026-09')).toBe(6);
  });

  it('turns months pregnant into an expected delivery month and back', () => {
    expect(eddForPregnancyMonth(5, '2026-10')).toBe('2027-02-01');
    expect(pregnancyMonth('2027-02-01', '2026-10')).toBe(5);
    expect(pregnancyMonth('2027-02-01', '2026-12')).toBe(7);
  });

  it('turns the last month at the centre into an exit date and back', () => {
    expect(exitAfterMonth('2026-12')).toBe('2027-01-01');
    expect(lastMonthBeforeExit('2027-01-01')).toBe('2026-12');
    expect(lastMonthBeforeExit('2026-09-19')).toBe('2026-09');
  });
});
