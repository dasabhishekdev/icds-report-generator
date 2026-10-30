import type { Settings } from '../db/schema';
import { dotted } from '../domain/dates';
import type { MonthSummary } from '../domain/month';
import { periodSlug, trimNum } from './common';
import { S, SheetBuilder, type SheetModel } from './sheet';

export function buildNutritionVoucher(summary: MonthSummary, settings: Settings): SheetModel {
  const c = settings.center;
  const b = new SheetBuilder({
    id: 'voucher',
    name: `Nutrition_Voucher_${periodSlug(summary)}`,
    fileName: `2_AWC_${c.number}_Nutrition_Voucher_${periodSlug(summary)}`,
    title: 'পুষ্টি ভাউচার (Nutrition Voucher)',
    colWidths: [12, 28, 16, 18, 24, 22],
    landscape: false,
  });
  const { meals, purchase, totals } = summary;

  b.mergeSet('A1:F1', `সুসংহত শিশু বিকাশ প্রকল্প আধিকারিক - ${c.project} (কেন্দ্র নং: ${c.number})`, S.title).height(1, 28);
  b.mergeSet(
    'A2:F2',
    `জেলা: ${c.district} | সময়কাল: ${dotted(summary.firstDate)} হইতে ${dotted(summary.lastDate)} (${summary.servedDays} দিন) | কর্মী: ${c.workerName}`,
    S.infoCenter,
  ).height(2, 22);

  b.mergeSet('A4:F4', 'খাবার ও ডিমের সংক্ষিপ্ত হিসাব (Meal & Egg Summary)', S.section);
  b.set('A5', 'খাবার (Meal Type)', S.header)
    .set('B5', 'মা (Mother)', S.header)
    .set('C5', 'শিশু (Children)', S.header)
    .set('D5', 'মোট (Total)', S.header)
    .set('E5', 'ডিমের হিসাব (Egg Breakdown)', S.header)
    .set('F5', 'পরিমান (Count)', S.header);

  const motherMeals = meals.khichuri.mother + meals.rice.mother;
  const childMeals = meals.khichuri.child + meals.rice.child;
  b.set('A6', 'খিচুড়ি (Khichuri)', S.text)
    .set('B6', meals.khichuri.mother)
    .set('C6', meals.khichuri.child)
    .set('D6', meals.khichuri.mother + meals.khichuri.child, S.cellBold, 'B6+C6')
    .set('E6', 'মা (Mother Eggs)', S.text)
    .set('F6', `${trimNum(totals.ration.mother.egg)} টি`)
    .set('A7', 'ভাত (Rice)', S.text)
    .set('B7', meals.rice.mother)
    .set('C7', meals.rice.child)
    .set('D7', meals.rice.mother + meals.rice.child, S.cellBold, 'B7+C7')
    .set('E7', 'শিশু (Children Eggs)', S.text)
    .set('F7', `${trimNum(totals.ration.child.egg)} টি`)
    .set('A8', 'সর্বমোট (Grand Total)', S.totalLeft)
    .set('B8', motherMeals, S.total, 'SUM(B6:B7)')
    .set('C8', childMeals, S.total, 'SUM(C6:C7)')
    .set('D8', motherMeals + childMeals, S.total, 'SUM(D6:D7)')
    .set('E8', 'মোট ডিম (Total Eggs)', S.totalLeft)
    .set('F8', `${trimNum(totals.ration.total.egg)} টি`, S.total);
  for (const r of [6, 7, 8]) b.height(r, 20);

  b.mergeSet('A10:F10', 'পরিপূরক পুষ্টি তৈরীর জন্য অতিরিক্ত উপাদান (সবজি ও ডিম) কেনার হিসাব', S.section);
  b.set('A11', 'ক্রমিক নং', S.header)
    .set('B11', 'দ্রব্যের নাম (Item Name)', S.header)
    .set('C11', 'দ্রব্যের দর (Rate)', S.header)
    .set('D11', 'দ্রব্যের পরিমান (Quantity)', S.header)
    .set('E11', 'একক (Unit)', S.header)
    .set('F11', 'খরচ - টাকা (Cost in Rs.)', S.header)
    .height(11, 24);

  const grams = (g: number) => `গ্রাম (Grams) [${(g / 1000).toFixed(3)} Kg]`;
  const lines = [
    { name: 'ডিম (Eggs)', p: purchase.egg, unit: 'টি (Pcs)', perKg: false },
    { name: 'সবজী (Vegetables)', p: purchase.veg, unit: grams(purchase.veg.quantity), perKg: true },
    { name: 'আলু (Potato)', p: purchase.potato, unit: grams(purchase.potato.quantity), perKg: true },
    { name: 'ছাতু (Chatu / Roasted Gram Flour)', p: purchase.chatu, unit: grams(purchase.chatu.quantity), perKg: true },
  ];
  lines.forEach((line, i) => {
    const r = 12 + i;
    b.set(`A${r}`, i + 1)
      .set(`B${r}`, line.name, S.text)
      .set(`C${r}`, line.p.rate, S.money)
      .set(`D${r}`, line.p.quantity)
      .set(`E${r}`, line.unit, S.text)
      .set(`F${r}`, line.p.cost, S.money, line.perKg ? `ROUND(C${r}*D${r}/1000,2)` : `ROUND(C${r}*D${r},2)`)
      .height(r, 22);
  });
  b.mergeSet('A16:E16', 'মোট খরচ (Total Expenditure)', S.totalLeft)
    .set('F16', summary.purchaseTotal, S.totalMoney, 'SUM(F12:F15)')
    .height(16, 24);

  b.mergeSet('A18:C18', `দোকানদারের স্বাক্ষর (Shopkeeper): ${c.vegShopkeeper}`, S.label);
  b.mergeSet('D18:F18', `অঙ্গনওয়াড়ী কর্মীর স্বাক্ষর (AWW): ${c.workerName}`, S.label);
  return b.build();
}
