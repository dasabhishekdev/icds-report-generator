import type { Settings } from '../db/schema';
import type { MonthSummary } from '../domain/month';
import { buildFuelSpices } from './fuelSpices';
import { buildNutritionVoucher } from './nutritionVoucher';
import { buildSnpRegister } from './snpRegister';
import { buildStockRegister } from './stockRegister';
import type { SheetModel } from './sheet';

export const REPORT_IDS = ['fuel', 'voucher', 'snp', 'stock'] as const;
export type ReportId = (typeof REPORT_IDS)[number];

const BUILDERS: Record<ReportId, (summary: MonthSummary, settings: Settings) => SheetModel> = {
  fuel: buildFuelSpices,
  voucher: buildNutritionVoucher,
  snp: buildSnpRegister,
  stock: buildStockRegister,
};

/** All four registers in their printed order, or only the requested ones. */
export function buildAllReports(summary: MonthSummary, settings: Settings, only?: readonly ReportId[]): SheetModel[] {
  return REPORT_IDS.filter((id) => !only || only.includes(id)).map((id) => BUILDERS[id](summary, settings));
}
