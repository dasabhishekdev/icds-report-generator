import type { Beneficiary, Category, ChildBeneficiary, MotherBeneficiary, MotherStage } from '../db/schema';
import { addMonths, ageGroupMonths, dateReachingAgeGroup } from './dates';

export function isEnrolledOn(b: Beneficiary, date: string): boolean {
  if (date < b.enrolledOn) return false;
  if (b.exitedOn && date >= b.exitedOn) return false;
  return true;
}

export function motherStage(m: MotherBeneficiary, date: string, nursingMonths: number): MotherStage | null {
  if (!m.deliveryDate || date < m.deliveryDate) return 'pregnant';
  if (date < addMonths(m.deliveryDate, nursingMonths)) return 'nursing';
  return null;
}

/** The category a beneficiary falls into on a date, or null if not eligible (not enrolled, aged out, …). */
export function resolveCategory(
  b: Beneficiary,
  date: string,
  categories: readonly Category[],
  nursingMonths: number,
): Category | null {
  if (!isEnrolledOn(b, date)) return null;
  switch (b.kind) {
    case 'mother': {
      const stage = motherStage(b, date, nursingMonths);
      if (!stage) return null;
      return categories.find((c) => c.group === 'mother' && c.motherStage === stage) ?? null;
    }
    case 'child': {
      if (!b.dob) return null;
      const age = ageGroupMonths(b.dob, date);
      if (age < 0) return null;
      return childCategoryForAge(age, categories);
    }
    default: {
      const never: never = b;
      throw new Error(`Unknown beneficiary ${JSON.stringify(never)}`);
    }
  }
}

function childCategoryForAge(age: number, categories: readonly Category[]): Category | null {
  return categories.find((c) => c.group === 'child' && (c.minMonths ?? 0) <= age && age < (c.maxMonths ?? Infinity)) ?? null;
}

/** Enrolled children whose date of birth is still missing; they cannot be placed in a category. */
export function childrenWithoutDob(beneficiaries: readonly Beneficiary[], date: string): ChildBeneficiary[] {
  return beneficiaries.filter((b): b is ChildBeneficiary => b.kind === 'child' && !b.dob && isEnrolledOn(b, date));
}

/** When a child next changes category (or ages out) after `date`, by the day-after-anniversary rule. */
export function nextChildShift(
  child: ChildBeneficiary,
  date: string,
  categories: readonly Category[],
): { on: string; to: Category | null } | null {
  if (!child.dob) return null;
  const age = ageGroupMonths(child.dob, date);
  if (age < 0) return null;
  const current = childCategoryForAge(age, categories);
  const upper = current?.maxMonths;
  if (upper === undefined || !Number.isFinite(upper)) return null;
  return { on: dateReachingAgeGroup(child.dob, upper), to: childCategoryForAge(upper, categories) };
}

/** Beneficiaries who can be marked present on a date, grouped in category order. */
export function eligibleOn(
  beneficiaries: readonly Beneficiary[],
  date: string,
  categories: readonly Category[],
  nursingMonths: number,
): { category: Category; members: Beneficiary[] }[] {
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const groups = new Map<string, Beneficiary[]>();
  for (const b of beneficiaries) {
    const cat = resolveCategory(b, date, sorted, nursingMonths);
    if (!cat || !cat.servesMeal) continue;
    const list = groups.get(cat.id) ?? [];
    list.push(b);
    groups.set(cat.id, list);
  }
  return sorted
    .filter((c) => groups.has(c.id))
    .map((category) => ({
      category,
      members: groups.get(category.id)!.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
