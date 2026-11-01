/**
 * The paper register records ages in whole months for the month it covers ("2 y 3 m", "5 months
 * pregnant", "baby 3 months"), not dates. These helpers turn such values into the dates the
 * calculations run on, and back.
 */
import { addDays, addMonths, ageGroupMonths, dateRange, lastDateOfMonth, shiftMonth } from './dates';

/** Pregnancy length the expected delivery month is counted from. */
export const PREGNANCY_MONTHS = 9;

export function monthsBetween(fromMonth: string, toMonth: string): number {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

const daysAtAge = (dob: string, months: number, month: string) =>
  dateRange(`${month}-01`, lastDateOfMonth(month)).filter((date) => ageGroupMonths(dob, date) === months).length;

/**
 * A date of birth that keeps the child at `months` on as many days of `month` as the calendar
 * allows (all, or all but one), then on as many days of the next month at `months + 1`.
 */
export function dobForRegisterAge(months: number, month: string): string {
  const anchor = addMonths(`${month}-01`, -months);
  const next = shiftMonth(month, 1);
  let best = anchor;
  let bestScore = -1;
  for (let i = -31; i <= 31; i += 1) {
    const dob = addDays(anchor, i);
    const score = daysAtAge(dob, months, month) * 100 + daysAtAge(dob, months + 1, next);
    if (score > bestScore) [best, bestScore] = [dob, score];
  }
  return best;
}

/** Age in completed months as the register for `month` would write it (read mid-month). */
export const registerAge = (dob: string, month: string): number => ageGroupMonths(dob, `${month}-15`);

/** A baby `months` old in the register for `month` is counted as born on the 1st of its birth month. */
export const deliveryForBabyAge = (months: number, month: string): string => addMonths(`${month}-01`, -months);

export const babyAge = (deliveryDate: string, month: string): number => monthsBetween(deliveryDate.slice(0, 7), month);

export const eddForPregnancyMonth = (months: number, month: string): string =>
  addMonths(`${month}-01`, PREGNANCY_MONTHS - months);

export const pregnancyMonth = (expectedDeliveryDate: string, month: string): number =>
  PREGNANCY_MONTHS - monthsBetween(month, expectedDeliveryDate.slice(0, 7));

/** Exit date (first day away) for someone whose last month at the centre is `month`. */
export const exitAfterMonth = (month: string): string => `${shiftMonth(month, 1)}-01`;

export const lastMonthBeforeExit = (exitedOn: string): string => addDays(exitedOn, -1).slice(0, 7);
