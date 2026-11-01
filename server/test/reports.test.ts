import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { MongoClient } from 'mongodb';
import { sampleData } from '../../src/db/sampleData';
import type { BackupFile } from '../../src/db/schema';
import { buildApp } from '../src/app';
import { SESSION_COOKIE } from '../src/auth';
import { embeddedFontCss } from '../src/reports/fonts';
import { createPdfRenderer, findChrome, type PdfRenderer } from '../src/reports/pdf';
import { diskStorage, s3Storage, type ReportStorage } from '../src/reports/storage';

const MONGO_URL = process.env.MONGO_URL;
const CHROME = findChrome(process.env.CHROME_PATH);
/** Any S3-compatible endpoint, e.g. adobe/s3mock on http://127.0.0.1:9090. */
const S3_ENDPOINT = process.env.S3_TEST_ENDPOINT;
const FONT_DIR = join(process.cwd(), 'node_modules/@fontsource/noto-sans-bengali');

const pageSizes = (pdf: Buffer) =>
  [...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map(([, w, h]) => [
    Math.round(Number(w)),
    Math.round(Number(h)),
  ]);

const backends: { name: string; make: () => Promise<{ storage: ReportStorage; exists?: (key: string) => boolean; cleanup: () => void }> }[] = [
  {
    name: 'disk',
    make: async () => {
      const dir = mkdtempSync(join(tmpdir(), 'icds-reports-'));
      return { storage: diskStorage(dir), exists: (key) => existsSync(join(dir, key)), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
    },
  },
];
if (S3_ENDPOINT) {
  backends.push({
    name: 's3',
    make: async () => {
      const bucket = `icds-test-${Date.now()}`;
      const cfg = { bucket, region: 'us-east-1', endpoint: S3_ENDPOINT, accessKeyId: 'test', secretAccessKey: 'test', forcePathStyle: true, prefix: 'icds' };
      await new S3Client({ region: cfg.region, endpoint: cfg.endpoint, forcePathStyle: true, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } }).send(
        new CreateBucketCommand({ Bucket: bucket }),
      );
      return { storage: s3Storage(cfg), cleanup: () => undefined };
    },
  });
}

describe.skipIf(!MONGO_URL || !CHROME).each(backends)('report generation with $name storage', ({ make }) => {
  let client: MongoClient;
  let app: FastifyInstance;
  let renderer: PdfRenderer;
  let backend: Awaited<ReturnType<(typeof backends)[number]['make']>>;
  const dbName = `icds-reports-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    client = new MongoClient(MONGO_URL!, { ignoreUndefined: true });
    await client.connect();
    backend = await make();
    renderer = createPdfRenderer(CHROME!);
    const fontCss = embeddedFontCss(FONT_DIR);
    app = await buildApp(
      client.db(dbName),
      { port: 0, mongoUrl: MONGO_URL!, cookieSecure: false, allowRegistration: true, fontDir: FONT_DIR, reportsDir: '' },
      { reports: { storage: backend.storage, renderer, fontCss: () => fontCss } },
    );
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await client?.db(dbName).dropDatabase();
    await client?.close();
    backend?.cleanup();
  });

  const register = async (login: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { login, password: 'report pass', name: 'Worker', center: { name: 'Report Centre', number: '547' } },
    });
    const c = res.cookies.find((x) => x.name === SESSION_COOKIE)!;
    return `${SESSION_COOKIE}=${c.value}`;
  };
  const call = (cookie: string, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown): Promise<LightMyRequestResponse> =>
    app.inject({ method, url, headers: { cookie }, payload: payload as object });

  it('generates, stores, lists, downloads and deletes a month of reports', async () => {
    const owner = await register(`owner-${Math.random()}@test.in`);
    const backup: BackupFile = { app: 'icds-report-generator', version: 1, exportedAt: new Date().toISOString(), ...sampleData() };
    expect((await call(owner, 'POST', '/api/import', backup)).statusCode).toBe(200);

    const created = await call(owner, 'POST', '/api/reports', { from: '2026-09-01', to: '2026-09-30', paper: 'A4' });
    expect(created.statusCode).toBe(201);
    const report = created.json();
    expect(report.summary).toMatchObject({ servedDays: 27, purchaseTotal: 9072.64 });
    expect(report.files.map((f: { kind: string }) => f.kind)).toEqual(['pdf', 'xlsx']);

    const list = (await call(owner, 'GET', '/api/reports?month=2026-09')).json();
    expect(list.map((r: { id: string }) => r.id)).toEqual([report.id]);
    expect((await call(owner, 'GET', '/api/reports?month=2026-08')).json()).toEqual([]);

    const pdf = await call(owner, 'GET', `/api/reports/${report.id}/files/pdf`);
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(String(pdf.headers['content-disposition'])).toMatch(/^attachment; filename="AWC_547_ICDS_Reports_Sep2026_A4\.pdf"/);
    expect(pdf.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    // Four registers: fuel and voucher (portrait), SNP and stock (landscape) on A4.
    expect(pageSizes(pdf.rawPayload)).toEqual([
      [595, 842],
      [595, 842],
      [842, 595],
      [842, 595],
    ]);

    const inline = await call(owner, 'GET', `/api/reports/${report.id}/files/pdf?inline=1`);
    expect(String(inline.headers['content-disposition'])).toMatch(/^inline;/);

    const xlsx = await call(owner, 'GET', `/api/reports/${report.id}/files/xlsx`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx.rawPayload as unknown as ArrayBuffer);
    const voucher = wb.worksheets[1];
    expect(voucher.getCell('B6').value).toBe(55);
    expect((voucher.getCell('F16').value as { result: number }).result).toBe(9072.64);

    const intruder = await register(`intruder-${Math.random()}@test.in`);
    expect((await call(intruder, 'GET', `/api/reports/${report.id}/files/pdf`)).statusCode).toBe(404);
    expect((await call(intruder, 'DELETE', `/api/reports/${report.id}`)).statusCode).toBe(404);
    expect((await call(intruder, 'GET', '/api/reports')).json()).toEqual([]);

    expect((await call(owner, 'DELETE', `/api/reports/${report.id}`)).statusCode).toBe(204);
    expect((await call(owner, 'GET', `/api/reports/${report.id}/files/pdf`)).statusCode).toBe(404);
    if (backend.exists) {
      const userPrefix = `users/${(await call(owner, 'GET', '/api/auth/me')).json().user.id}/2026-09/${report.id}`;
      expect(backend.exists(`${userPrefix}/AWC_547_ICDS_Reports_Sep2026_A4.pdf`)).toBe(false);
    }
  }, 120_000);

  it('prints A3 pages when A3 is chosen', async () => {
    const cookie = await register(`a3-${Math.random()}@test.in`);
    const created = (await call(cookie, 'POST', '/api/reports', { from: '2026-10-01', to: '2026-10-31', paper: 'A3' })).json();
    const pdf = await call(cookie, 'GET', `/api/reports/${created.id}/files/pdf`);
    expect(pageSizes(pdf.rawPayload)).toEqual([
      [842, 1191],
      [842, 1191],
      [1191, 842],
      [1191, 842],
    ]);
  }, 120_000);

  it('exports a single register and a date range', async () => {
    const cookie = await register(`range-${Math.random()}@test.in`);
    const backup: BackupFile = { app: 'icds-report-generator', version: 1, exportedAt: new Date().toISOString(), ...sampleData() };
    await call(cookie, 'POST', '/api/import', backup);

    const single = await call(cookie, 'POST', '/api/reports', { from: '2026-09-01', to: '2026-09-30', paper: 'A4', sheets: ['voucher'] });
    expect(single.statusCode).toBe(201);
    expect(single.json()).toMatchObject({ sheets: ['voucher'], files: [{ name: 'AWC_547_2_Nutrition_Voucher_Sep2026_A4.pdf' }, {}] });
    const singlePdf = await call(cookie, 'GET', `/api/reports/${single.json().id}/files/pdf`);
    expect(pageSizes(singlePdf.rawPayload)).toEqual([[595, 842]]);
    const singleXlsx = new ExcelJS.Workbook();
    await singleXlsx.xlsx.load((await call(cookie, 'GET', `/api/reports/${single.json().id}/files/xlsx`)).rawPayload as unknown as ArrayBuffer);
    expect(singleXlsx.worksheets.map((w) => w.name)).toEqual(['Nutrition_Voucher_Sep2026']);

    const range = await call(cookie, 'POST', '/api/reports', { from: '2026-09-07', to: '2026-09-12', paper: 'A4', sheets: ['stock'] });
    expect(range.statusCode).toBe(201);
    const body = range.json();
    expect(body).toMatchObject({ month: '2026-09', from: '2026-09-07', to: '2026-09-12', summary: { servedDays: 6 } });
    expect(body.files[0].name).toBe('AWC_547_4_Stock_Consumption_Register_07Sep-12Sep2026_A4.pdf');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await call(cookie, 'GET', `/api/reports/${body.id}/files/xlsx`)).rawPayload as unknown as ArrayBuffer);
    const stock = wb.worksheets[0];
    // Opening rice for 7 Sep = 339030 minus the 1st–5th consumption (3000+2180+3000+2180+3000).
    expect(stock.getCell('U3').value).toBe('খাদ্য সামগ্রী-৩: চাল (Rice) [OB: 325670 গ্রাম (g)]');
    expect(stock.getCell('A5').value).toBe(7);
    expect(stock.getCell('A1').value).toContain('07.09.2026 - 12.09.2026');
  }, 120_000);

  it('rejects bad input', async () => {
    const cookie = await register(`bad-${Math.random()}@test.in`);
    expect((await call(cookie, 'POST', '/api/reports', { from: '2026-09-31', to: '2026-10-01', paper: 'A4' })).statusCode).toBe(400);
    expect((await call(cookie, 'POST', '/api/reports', { from: '2026-09-10', to: '2026-09-01', paper: 'A4' })).statusCode).toBe(400);
    expect((await call(cookie, 'POST', '/api/reports', { from: '2026-01-01', to: '2026-06-30', paper: 'A4' })).statusCode).toBe(400);
    expect((await call(cookie, 'POST', '/api/reports', { from: '2026-09-01', to: '2026-09-30', paper: 'A4', sheets: ['nope'] })).statusCode).toBe(400);
    expect((await call(cookie, 'POST', '/api/reports', { from: '2026-09-01', to: '2026-09-30', paper: 'A5' })).statusCode).toBe(400);
    expect((await call(cookie, 'GET', '/api/reports/not-an-id/files/pdf')).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/reports', payload: { from: '2026-09-01', to: '2026-09-30', paper: 'A4' } })).statusCode).toBe(401);
  });
});
