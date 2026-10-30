import { STOCK_ITEM_KEYS, type Settings, type StockItemKey } from '../db/schema';
import { STOCK_AGE_BANDS } from '../domain/calc';
import { dotted } from '../domain/dates';
import type { MonthSummary } from '../domain/month';
import { STOCK_LABEL, STOCK_LABEL_EN, dayLabel, holidayText, mealLabel, periodLabel, periodSlug, stockUnit, trimNum } from './common';
import { addr, blankZero, colLetter, S, SheetBuilder, zebra, type SheetModel } from './sheet';

/** First column (1-based) of each stock item's receipt / consumption / balance triple. */
const STOCK_COL: Record<StockItemKey, number> = { chatu: 18, rice: 21, dal: 24, oil: 27, salt: 30 };
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

export function buildStockRegister(summary: MonthSummary, settings: Settings): SheetModel {
  const c = settings.center;
  const b = new SheetBuilder({
    id: 'stock',
    name: `Stock_Consumption_${periodSlug(summary)}`,
    fileName: `4_AWC_${c.number}_Stock_Consumption_Register_${periodSlug(summary)}`,
    title: 'মজুত ও খরচ রেজিস্টার (Stock)',
    colWidths: [12, 12, ...Array(30).fill(11)],
    landscape: true,
  });

  b.mergeSet(
    'A1:AF1',
    `অংশ ২: পরিপূরক আহারের খাদ্য সামগ্রীর দৈনিক খরচ ও মজুতের বিবরণ (${periodLabel(summary)}) - কেন্দ্র নং: ${c.number} (Code: ${c.code})`,
    S.title,
  ).height(1, 28);

  b.mergeSet('A3:B3', 'তারিখ ও খাবার', S.header).mergeSet(
    'C3:Q3',
    'পরিকল্পিত রেশন সংখ্যা (Beneficiary Attendance Breakdown)',
    S.header,
  );
  STOCK_ITEM_KEYS.forEach((item, i) => {
    const col = STOCK_COL[item];
    const range = `${colLetter(col)}3:${colLetter(col + 2)}3`;
    b.mergeSet(
      range,
      `খাদ্য সামগ্রী-${BN_DIGITS[i + 2]}: ${STOCK_LABEL[item]} (${STOCK_LABEL_EN[item]}) [OB: ${trimNum(summary.opening[item])}]`,
      S.header,
    );
  });
  b.height(3, 22);

  const sub = [
    'তারিখ', 'খাবার', 'গর্ভবতী', 'প্রসূতি',
    ...STOCK_AGE_BANDS.flatMap((band) => [`${band.label} (M)`, `${band.label} (F)`]),
    'মোট মা', 'মোট শিশু', 'সর্বমোট',
  ];
  sub.forEach((h, i) => b.set(addr(4, i + 1), h, S.subHeader));
  for (const item of STOCK_ITEM_KEYS) {
    const col = STOCK_COL[item];
    const name = STOCK_LABEL[item];
    b.set(addr(4, col), `প্রাপ্তি (${name})`, S.subHeader)
      .set(addr(4, col + 1), `খরচ (${name})`, S.subHeader)
      .set(addr(4, col + 2), `মজুত (${name})`, S.subHeader);
  }
  b.height(4, 28);

  const first = 5;
  const lastBalance: Record<StockItemKey, string> = { chatu: '', rice: '', dal: '', oil: '', salt: '' };
  summary.rows.forEach((row, i) => {
    const r = first + i;
    b.height(r, 18);
    const holiday = row.status.kind === 'holiday';
    const cell = holiday ? S.holidayCell : zebra(S.cell, i);
    const bold = holiday ? S.holidayCell : zebra(S.cellBold, i);
    const qty = holiday ? S.holidayCell : zebra({ ...S.cell, numFmt: '#,##0.##' }, i);

    b.set(`A${r}`, dayLabel(row, summary), cell);
    if (holiday) b.set(`B${r}`, holidayText(row, 'short'), S.holiday);
    else b.set(`B${r}`, row.served ? mealLabel(row.meal!, false) : null, cell);

    const k = row.counts;
    if (row.served) {
      b.set(`C${r}`, k.pregnant, cell).set(`D${r}`, k.nursing, cell);
      STOCK_AGE_BANDS.forEach((band, j) => {
        b.set(addr(r, 5 + j * 2), k.bands[band.key].M, cell).set(addr(r, 6 + j * 2), k.bands[band.key].F, cell);
      });
      b.set(`O${r}`, k.mothers, bold, `C${r}+D${r}`)
        .set(`P${r}`, k.children, bold, `SUM(E${r}:N${r})`)
        .set(`Q${r}`, k.total, bold, `O${r}+P${r}`);
    } else {
      for (let col = 3; col <= 17; col++) b.set(addr(r, col), null, cell);
    }

    for (const item of STOCK_ITEM_KEYS) {
      const col = STOCK_COL[item];
      const recv = addr(r, col);
      const used = addr(r, col + 1);
      const bal = addr(r, col + 2);
      const receipt = row.receipts[item];
      const consumption = row.consumption[item];
      b.set(recv, blankZero(receipt), qty).set(used, blankZero(consumption), qty);
      const moved = receipt !== 0 || consumption !== 0;
      if (holiday && !moved) {
        b.set(bal, null, qty);
        continue;
      }
      const previous = lastBalance[item] || trimNum(summary.opening[item]);
      b.set(bal, row.closing[item], qty, `${previous}+${recv}-${used}`);
      lastBalance[item] = bal;
    }
  });

  const last = first + summary.rows.length - 1;
  const t = last + 1;
  const tc = summary.totals.counts;
  const sum = (col: number) => `SUM(${colLetter(col)}${first}:${colLetter(col)}${last})`;
  b.set(`A${t}`, 'মোট', S.total).set(`B${t}`, `${summary.servedDays} দিন`, S.total);
  const countTotals = [
    tc.pregnant, tc.nursing,
    ...STOCK_AGE_BANDS.flatMap((band) => [tc.bands[band.key].M, tc.bands[band.key].F]),
    tc.mothers, tc.children, tc.total,
  ];
  countTotals.forEach((v, i) => b.set(addr(t, 3 + i), v, S.total, sum(3 + i)));
  const total = { ...S.total, numFmt: '#,##0.##' };
  for (const item of STOCK_ITEM_KEYS) {
    const col = STOCK_COL[item];
    const received = summary.rows.reduce((s, row) => s + row.receipts[item], 0);
    const used = summary.rows.reduce((s, row) => s + row.consumption[item], 0);
    b.set(addr(t, col), received, total, sum(col))
      .set(addr(t, col + 1), Math.round(used * 100) / 100, total, sum(col + 1))
      .set(addr(t, col + 2), summary.closing[item], total, lastBalance[item] || undefined);
  }
  b.height(t, 24);

  const m = summary.meals;
  const motherTotal = m.khichuri.mother + m.rice.mother;
  const childTotal = m.khichuri.child + m.rice.child;
  b.mergeSet(
    `A${t + 2}:Q${t + 2}`,
    `মোট রান্নার দিন: ${summary.servedDays} দিন | মা: খিচুড়ি ${m.khichuri.mother}, ভাত ${m.rice.mother} (মোট ${motherTotal}) | শিশু: খিচুড়ি ${m.khichuri.child}, ভাত ${m.rice.child} (মোট ${childTotal})`,
    S.footer,
  );
  b.mergeSet(`R${t + 2}:AF${t + 2}`, `${receiptSummary(summary)} | কর্মী: ${c.workerName}`, S.footer).height(t + 2, 34);
  return b.build();
}

function receiptSummary(summary: MonthSummary): string {
  if (summary.receipts.length === 0) return 'এই মাসে কোনো খাদ্য সামগ্রী প্রাপ্তি নেই';
  const groups = new Map<string, typeof summary.receipts>();
  for (const r of summary.receipts) {
    const key = `${r.date}|${r.challanNo ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const [date, challan] = key.split('|');
      const items = list.map((r) => `${STOCK_LABEL[r.item]} ${trimNum(r.quantity / 1000)} ${stockUnit(r.item)}`).join(', ');
      return `খাদ্য পাওয়ার তারিখ: ${dotted(date)}${challan ? ` | চালান নং: ${challan}` : ''} | প্রাপ্তি: ${items}`;
    })
    .join('; ');
}
