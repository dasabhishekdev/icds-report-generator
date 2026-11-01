import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sampleData } from '../db/sampleData';
import { buildMonthSummary } from '../domain/month';
import { workbookBlob } from './excel';
import { buildAllReports } from './index';

const data = sampleData();
const reports = buildAllReports(buildMonthSummary('2026-09', data), data.settings);
const [fuel, voucher, snp, stock] = reports;
const v = (model: (typeof reports)[number], address: string) => model.cells.get(address)?.value;

describe('September 2026 reports', () => {
  it('fuel & spices register lists daily beneficiaries', () => {
    expect(v(fuel, 'A3')).toBe('নথিভুক্ত গর্ভবতী: 3 | প্রসূতি: 2');
    expect(v(fuel, 'G3')).toBe('শিশু (৩ বঃ - ৬ বঃ): 25');
    expect(v(fuel, 'B7')).toBe(1);
    expect(v(fuel, 'H7')).toBe(40);
    expect(v(fuel, 'I12')).toBe('রবিবার / ছুটি (Sunday)');
  });

  it('fuel & spices register bills Rs 43.95 per cooking day', () => {
    expect(v(fuel, 'I7')).toBe(43.95);
    expect(fuel.cells.get('I37')).toMatchObject({ value: 1186.65, formula: 'SUM(I7:I36)' });
    expect(v(fuel, 'A48')).toBe('জ্বালানী ও মশলা বাবদ 1,186 টাকা 65 পয়সা (27 দিন × 43.95 টাকা) প্রকৃতই খরচ করিয়াছি।');
  });

  it('nutrition voucher matches the submitted voucher', () => {
    expect(v(voucher, 'A2')).toContain('01.09.2026 হইতে 30.09.2026 (27 দিন)');
    expect(v(voucher, 'B6')).toBe(55);
    expect(v(voucher, 'C7')).toBe(471);
    expect(v(voucher, 'F8')).toBe('833.5 টি');
    expect(v(voucher, 'F12')).toBe(7084.75);
    expect(v(voucher, 'F16')).toBe(9072.64);
  });

  it('SNP register totals and footer', () => {
    expect(v(snp, 'B5')).toBe('খিচুড়ি (Kh)');
    expect(v(snp, 'K5')).toBe(182.75);
    expect(v(snp, 'O35')).toBe(9072.64);
    expect(v(snp, 'A37')).toContain('মোট 9,072 টাকা 64 পয়সা (Rupees 9,073.00');
  });

  it('SNP register can show money in paise like the printed form', () => {
    const settings = { ...data.settings, snpInPaise: true };
    const paise = buildAllReports(buildMonthSummary('2026-09', data), settings)[2];
    expect(paise.cells.get('K5')).toMatchObject({ value: 18275, style: { numFmt: '0' } });
    expect(v(paise, 'K35')).toBe(708475);
    expect(paise.cells.get('O35')).toMatchObject({ value: 907264, formula: 'SUM(O5:O34)' });
    expect(v(paise, 'K4')).toBe('ডিম: মা ও শিশুর\n(Col 8 - পঃ)');
    expect(v(paise, 'A37')).toContain('মোট 9,072 টাকা 64 পয়সা');
  });

  it('stock register carries balances with formulas', () => {
    expect(v(stock, 'U3')).toBe('খাদ্য সামগ্রী-৩: চাল (Rice) [OB: 339030 গ্রাম (g)]');
    expect(stock.cells.get('W5')).toMatchObject({ value: 336030, formula: '339030+U5-V5' });
    expect(v(stock, 'W34')).toBe(267310);
    expect(v(stock, 'X20')).toBe(30000);
    expect(v(stock, 'R37')).toContain('চালান নং: 1429');
    expect(v(stock, 'R37')).not.toContain('ছাতু');
  });

  it('stock register shows chatu used but no receipts or balance', () => {
    expect(v(stock, 'R3')).toBe('খাদ্য সামগ্রী-২: ছাতু (Chatu) [ক্রয় - Bought]');
    expect(v(stock, 'S5')).toBeNull();
    expect(v(stock, 'S6')).toBe(370);
    expect(v(stock, 'T6')).toBeNull();
    expect(stock.cells.get('S35')).toMatchObject({ value: 4710, formula: 'SUM(S5:S34)' });
    expect(v(stock, 'T35')).toBeNull();
  });

  it('stock register use and balance are quantities in grams, not money', () => {
    expect(v(stock, 'V4')).toBe('খরচ (চাল)\nগ্রাম (g)');
    expect(v(stock, 'W4')).toBe('মজুত (চাল)\nগ্রাম (g)');
    expect(v(stock, 'S4')).toBe('খরচ (ছাতু)\nগ্রাম (g)');
    for (const address of ['S6', 'V5', 'W5', 'W34', 'S35', 'V35', 'W35']) {
      expect(stock.cells.get(address)?.style.numFmt, address).toBe('#,##0.##');
    }
  });

  it('writes a valid xlsx workbook', async () => {
    const blob = await workbookBlob(reports);
    const buffer = Buffer.from(await blob.arrayBuffer());
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    if (process.env.WRITE_SAMPLE_XLSX) {
      mkdirSync('tmp', { recursive: true });
      writeFileSync('tmp/sample-sep-2026.xlsx', buffer);
    }
  });
});
