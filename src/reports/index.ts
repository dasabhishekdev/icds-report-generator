import type { Settings } from '../db/schema';
import type { MonthSummary } from '../domain/month';
import { buildFuelSpices } from './fuelSpices';
import { buildNutritionVoucher } from './nutritionVoucher';
import { buildSnpRegister } from './snpRegister';
import { buildStockRegister } from './stockRegister';
import type { SheetModel } from './sheet';

export function buildAllReports(summary: MonthSummary, settings: Settings): SheetModel[] {
  return [
    buildFuelSpices(summary, settings),
    buildNutritionVoucher(summary, settings),
    buildSnpRegister(summary, settings),
    buildStockRegister(summary, settings),
  ];
}
