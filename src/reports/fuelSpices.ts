import type { Settings } from '../db/schema';
import type { MonthSummary } from '../domain/month';
import { dayLabel, holidayText, periodCaption, periodLabel, periodSlug, splitRupees } from './common';
import { blankZero, S, SheetBuilder, zebra, type SheetModel } from './sheet';
import { REPORT_TITLES } from './titles';

export function buildFuelSpices(summary: MonthSummary, settings: Settings): SheetModel {
  const c = settings.center;
  const b = new SheetBuilder({
    id: 'fuel',
    name: `Fuel_Spices_${periodSlug(summary)}`,
    fileName: `1_AWC_${c.number}_Fuel_Spices_${periodSlug(summary)}`,
    title: REPORT_TITLES.fuel,
    colWidths: [12, 16, 16, 15, 16, 14, 16, 16, 26],
    landscape: false,
  });
  const e = summary.enrolled;

  b.mergeSet('A1:I1', `অঙ্গনওয়াড়ী কেন্দ্রের জ্বালানী ও মশলা খরচের হিসাব (লোকাল ফুড) - ${c.number}`, S.title).height(1, 28);
  b.mergeSet('A2:C2', `কেন্দ্রের নাম ও নং: ${c.name}, ${c.number}`, S.info)
    .mergeSet('D2:F2', `গ্রাম পঞ্চায়েত/ওয়ার্ড নং: ${c.gramPanchayat}`, S.info)
    .mergeSet('G2:I2', `${periodCaption(summary)}: ${periodLabel(summary)}`, S.info)
    .height(2, 20);
  b.mergeSet('A3:C3', `নথিভুক্ত গর্ভবতী: ${e.pregnant} | প্রসূতি: ${e.nursing}`, S.info)
    .mergeSet('D3:F3', `শিশু (৬ মাস - ৩ বঃ): ${e.childUnder3}`, S.info)
    .mergeSet('G3:I3', `শিশু (৩ বঃ - ৬ বঃ): ${e.child3to6}`, S.info)
    .height(3, 20);

  b.mergeSet('A5:A6', 'তারিখ\n(Date)', S.header)
    .mergeSet('B5:C5', 'মা (Mother)', S.header)
    .mergeSet('D5:D6', 'মোট মা\n(Total Mother)', S.header)
    .mergeSet('E5:G5', 'শিশু (Children)', S.header)
    .mergeSet('H5:H6', 'মোট প্রাপক\n(Total Benef.)', S.header)
    .mergeSet('I5:I6', 'জ্বালানী ও মশলা খরচ / মন্তব্য\n(Remarks / Cost)', S.header)
    .set('B6', 'গর্ভবতী (Pregnant)', S.subHeader)
    .set('C6', 'প্রসূতি (Nursing)', S.subHeader)
    .set('E6', '৬ মাস - ৩ বঃ', S.subHeader)
    .set('F6', '১ বঃ - ৩ বঃ', S.subHeader)
    .set('G6', '৩ বঃ - ৬ বঃ', S.subHeader)
    .height(5, 22)
    .height(6, 24);

  const first = 7;
  summary.rows.forEach((row, i) => {
    const r = first + i;
    b.height(r, 19);
    if (row.status.kind === 'holiday') {
      for (const col of 'ABCDEFGH') b.set(`${col}${r}`, col === 'A' ? dayLabel(row, summary) : null, S.holidayCell);
      b.set(`I${r}`, holidayText(row, 'long'), { ...S.holiday, align: 'left' });
      return;
    }
    const cell = zebra(S.cell, i);
    const bold = zebra(S.cellBold, i);
    b.set(`A${r}`, dayLabel(row, summary), cell);
    if (!row.served) {
      for (const col of 'BCDEFGHI') b.set(`${col}${r}`, null, cell);
      return;
    }
    const k = row.counts;
    b.set(`B${r}`, k.pregnant, cell)
      .set(`C${r}`, k.nursing, cell)
      .set(`D${r}`, k.mothers, bold, `SUM(B${r}:C${r})`)
      .set(`E${r}`, blankZero(k.childUnder3), cell)
      .set(`F${r}`, null, cell)
      .set(`G${r}`, blankZero(k.child3to6), cell)
      .set(`H${r}`, k.total, bold, `D${r}+SUM(E${r}:G${r})`)
      .set(`I${r}`, null, zebra(S.text, i));
  });

  const last = first + summary.rows.length - 1;
  const t = first + summary.rows.length;
  const tc = summary.totals.counts;
  b.set(`A${t}`, 'মোট (Total)', S.total)
    .set(`B${t}`, tc.pregnant, S.total, `SUM(B${first}:B${last})`)
    .set(`C${t}`, tc.nursing, S.total, `SUM(C${first}:C${last})`)
    .set(`D${t}`, tc.mothers, S.total, `SUM(D${first}:D${last})`)
    .set(`E${t}`, tc.childUnder3, S.total, `SUM(E${first}:E${last})`)
    .set(`F${t}`, null, S.total)
    .set(`G${t}`, tc.child3to6, S.total, `SUM(G${first}:G${last})`)
    .set(`H${t}`, tc.total, S.total, `SUM(H${first}:H${last})`)
    .set(`I${t}`, `${summary.servedDays} Working Days`, S.total)
    .height(t, 22);

  const s = t + 2;
  b.mergeSet(`A${s}:I${s}`, 'দ্রব্যের বিবরণ ও স্বাক্ষর (Commodity Breakdown & Signatories)', S.section);
  const h = s + 1;
  b.mergeSet(`A${h}:B${h}`, 'দ্রব্যের নাম (Item)', S.subHeader)
    .set(`C${h}`, 'পরিমান/সংখ্যা (Qty)', S.subHeader)
    .set(`D${h}`, 'দর (Rate)', S.subHeader)
    .set(`E${h}`, 'মূল্য - টাকা (Rs.)', S.subHeader)
    .set(`F${h}`, 'মূল্য - পঃ (Paisa)', S.subHeader)
    .height(h, 28);

  summary.fuel.forEach((line, i) => {
    const r = h + 1 + i;
    const { rupees, paise } = splitRupees(line.amount);
    b.mergeSet(`A${r}:B${r}`, line.name, S.text)
      .set(`C${r}`, line.quantity ? `${line.quantity} ${line.unit}` : null, S.cell)
      .set(`D${r}`, blankZero(line.rate), S.money)
      .set(`E${r}`, line.amount ? rupees : null, S.cell)
      .set(`F${r}`, line.amount ? paise : null, S.cell)
      .height(r, 30);
  });
  const ft = h + 1 + summary.fuel.length;
  const total = splitRupees(summary.fuelTotal);
  b.mergeSet(`A${ft}:B${ft}`, 'মোট (Total)', { ...S.text, bold: true })
    .set(`C${ft}`, null, S.cell)
    .set(`D${ft}`, null, S.cell)
    .set(`E${ft}`, summary.fuelTotal ? total.rupees : null, S.cellBold)
    .set(`F${ft}`, summary.fuelTotal ? total.paise : null, S.cellBold)
    .height(ft, 22);

  const signature = { ...S.label, wrap: true };
  b.mergeSet(`G${h + 1}:I${h + 1}`, `দোকানদারের স্বাক্ষর (Shopkeeper):\n${c.fuelShopkeeper}`, signature)
    .mergeSet(`G${h + 3}:I${h + 3}`, `অঙ্গনওয়াড়ী কর্মীর স্বাক্ষর (AWW):\n${c.workerName}`, signature);

  return b.build();
}
