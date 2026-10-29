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
    expect(v(fuel, 'B7')).toBe(1);
    expect(v(fuel, 'H7')).toBe(40);
    expect(v(fuel, 'I12')).toBe('রবিবার / ছুটি (Sunday)');
    expect(v(fuel, 'I37')).toBe('27 Working Days');
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

  it('stock register carries balances with formulas', () => {
    expect(v(stock, 'U3')).toBe('খাদ্য সামগ্রী-৩: চাল (Rice) [OB: 339030]');
    expect(stock.cells.get('W5')).toMatchObject({ value: 336030, formula: '339030+U5-V5' });
    expect(v(stock, 'W34')).toBe(267310);
    expect(v(stock, 'X20')).toBe(30000);
    expect(v(stock, 'R37')).toContain('চালান নং: 1429');
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
