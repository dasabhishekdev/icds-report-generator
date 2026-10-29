import type { Settings } from '../db/schema';
import { monthLabel, monthShort } from '../domain/dates';
import type { MonthSummary } from '../domain/month';
import { holidayText, inr, mealLabel, splitRupees } from './common';
import { blankZero, S, SheetBuilder, zebra, type SheetModel } from './sheet';

export function buildSnpRegister(summary: MonthSummary, settings: Settings): SheetModel {
  const c = settings.center;
  const b = new SheetBuilder({
    id: 'snp',
    name: `SNP_Veg_Egg_${monthShort(summary.month)}`,
    fileName: `3_AWC_${c.number}_SNP_Veg_Egg_Register_${monthShort(summary.month)}`,
    title: 'সবজী ও ডিম রেজিস্টার (SNP)',
    colWidths: [10, 14, 12, 12, 12, 14, 14, 14, 12, 14, 16, 14, 14, 18, 16],
    landscape: true,
  });

  b.mergeSet(
    'A1:O1',
    `${c.project} সুসংহত শিশু বিকাশ প্রকল্প - অঙ্গনওয়াড়ী কেন্দ্রের সবজী ও ডিমের খরচ হিসাব (S.N.P.)`,
    S.title,
  ).height(1, 28);
  b.mergeSet(
    'A2:O2',
    `কেন্দ্রের নাম ও নং: ${c.name}, ${c.number} (Code: ${c.code}) | পঞ্চায়েত: ${c.gramPanchayat} | মাস ও সাল: ${monthLabel(summary.month)}`,
    S.infoCenter,
  ).height(2, 22);

  const headers = [
    'তারিখ\n(Date)', 'খাবার\n(Meal)', 'মা: গর্ভবতী\n(Col 1)', 'মা: প্রসূতি\n(Col 2)', 'মোট মা\n(Col 3)',
    'সবজি (টাকা)\n(Col 4)', 'আলু (টাকা)\n(Col 5)', 'ছাতু (টাকা)\n(Col 6)', 'শিশু\n(Col 7a)', 'মোট শিশু ও মা\n(Col 7b)',
    'ডিম: মা ও শিশুর\n(Col 8 - পঃ)', 'সবজি\n(Col 9 - পঃ)', 'আলু\n(Col 10 - পঃ)', 'সোয়াবিন/ফল/ছাতু\n(Col 11-13)', 'সর্বমোট খরচ\n(Col 14 - পঃ)',
  ];
  headers.forEach((h, i) => b.set(`${'ABCDEFGHIJKLMNO'[i]}4`, h, S.header));
  b.height(4, 30);

  const first = 5;
  summary.rows.forEach((row, i) => {
    const r = first + i;
    b.height(r, 19);
    if (row.status.kind === 'holiday') {
      for (const col of 'ACDEFGHIJKLMO') b.set(`${col}${r}`, col === 'A' ? row.day : null, S.holidayCell);
      b.set(`B${r}`, holidayText(row, 'short'), S.holiday).set(`N${r}`, 'ছুটি (Holiday)', S.holiday);
      return;
    }
    const cell = zebra(S.cell, i);
    const bold = zebra(S.cellBold, i);
    const money = zebra(S.money, i);
    const moneyBold = zebra(S.moneyBold, i);
    b.set(`A${r}`, row.day, cell);
    if (!row.served) {
      for (const col of 'BCDEFGHIJKLMNO') b.set(`${col}${r}`, null, cell);
      return;
    }
    const k = row.counts;
    const x = row.costs;
    b.set(`B${r}`, mealLabel(row.meal!, true), cell)
      .set(`C${r}`, k.pregnant, cell)
      .set(`D${r}`, k.nursing, cell)
      .set(`E${r}`, k.mothers, bold, `C${r}+D${r}`)
      .set(`F${r}`, blankZero(x.motherVeg), money)
      .set(`G${r}`, blankZero(x.motherPotato), money)
      .set(`H${r}`, blankZero(x.chatu), money)
      .set(`I${r}`, k.children, cell)
      .set(`J${r}`, k.total, bold, `E${r}+I${r}`)
      .set(`K${r}`, blankZero(x.egg), money)
      .set(`L${r}`, blankZero(x.childVeg), money)
      .set(`M${r}`, blankZero(x.childPotato), money)
      .set(`N${r}`, null, cell)
      .set(`O${r}`, x.total, moneyBold, `SUM(F${r}:H${r})+SUM(K${r}:M${r})`);
  });

  const last = first + summary.rows.length - 1;
  const t = last + 1;
  const tc = summary.totals.counts;
  const tx = summary.totals.costs;
  const sum = (col: string) => `SUM(${col}${first}:${col}${last})`;
  b.set(`A${t}`, 'সর্বমোট', S.total)
    .set(`B${t}`, `${summary.servedDays} দিন`, S.total)
    .set(`C${t}`, tc.pregnant, S.total, sum('C'))
    .set(`D${t}`, tc.nursing, S.total, sum('D'))
    .set(`E${t}`, tc.mothers, S.total, sum('E'))
    .set(`F${t}`, tx.motherVeg, S.totalMoney, sum('F'))
    .set(`G${t}`, tx.motherPotato, S.totalMoney, sum('G'))
    .set(`H${t}`, tx.chatu, S.totalMoney, sum('H'))
    .set(`I${t}`, tc.children, S.total, sum('I'))
    .set(`J${t}`, tc.total, S.total, sum('J'))
    .set(`K${t}`, tx.egg, S.totalMoney, sum('K'))
    .set(`L${t}`, tx.childVeg, S.totalMoney, sum('L'))
    .set(`M${t}`, tx.childPotato, S.totalMoney, sum('M'))
    .set(`N${t}`, null, S.total)
    .set(`O${t}`, tx.total, S.totalMoney, sum('O'))
    .height(t, 24);

  const { rupees, paise } = splitRupees(tx.total);
  b.mergeSet(
    `A${t + 2}:O${t + 2}`,
    `সবজি ও ডিম বাবদ মোট ${inr(rupees, 0)} টাকা ${paise} পয়সা (Rupees ${inr(Math.ceil(tx.total))} মেটানো যেতে পারে) | দোকানদার: ${c.vegShopkeeper} | কর্মী: ${c.workerName}`,
    S.footer,
  ).height(t + 2, 22);
  return b.build();
}
