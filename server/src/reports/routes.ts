import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { daysBetweenInclusive, lastDateOfMonth } from '../../../src/domain/dates';
import { buildPeriodSummary } from '../../../src/domain/month';
import { safeFilePart } from '../../../src/domain/photoName';
import { buildAllReports, REPORT_IDS, type ReportId } from '../../../src/reports';
import { periodSlug } from '../../../src/reports/common';
import { workbookBlob } from '../../../src/reports/excel';
import { loadUserData } from '../data';
import type { Collections, ReportDoc, ReportFile } from '../db';
import type { HolidayService } from '../holidays/service';
import { isoDateSchema, monthSchema } from '../schemas';
import { reportsDocument } from './document';
import type { PdfRenderer } from './pdf';
import type { ReportStorage } from './storage';

export interface ReportServices {
  storage: ReportStorage;
  /** Null when no Chromium is available; generation then answers 503. */
  renderer: PdfRenderer | null;
  fontCss: () => string;
}

const MAX_RANGE_DAYS = 93;

const generateSchema = z
  .strictObject({
    from: isoDateSchema,
    to: isoDateSchema,
    paper: z.enum(['A4', 'A3']),
    sheets: z.array(z.enum(REPORT_IDS)).min(1).max(REPORT_IDS.length).optional(),
  })
  .refine((b) => b.from <= b.to, { message: 'End date must be on or after the start date', path: ['to'] })
  .refine((b) => daysBetweenInclusive(b.from, b.to) <= MAX_RANGE_DAYS, {
    message: `A report can cover at most ${MAX_RANGE_DAYS} days`,
    path: ['to'],
  });

const SHEET_FILE: Record<ReportId, string> = {
  fuel: '1_Fuel_Spices',
  voucher: '2_Nutrition_Voucher',
  snp: '3_SNP_Veg_Egg_Register',
  stock: '4_Stock_Consumption_Register',
};
const listSchema = z.strictObject({ month: monthSchema.optional() });
const fileParams = z.strictObject({ id: z.string().regex(/^[a-f0-9]{24}$/), kind: z.enum(['pdf', 'xlsx']) });
const idParams = z.strictObject({ id: z.string().regex(/^[a-f0-9]{24}$/) });

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export function publicReport(doc: ReportDoc) {
  return {
    id: doc._id.toHexString(),
    month: doc.month,
    from: doc.from ?? `${doc.month}-01`,
    to: doc.to ?? lastDateOfMonth(doc.month),
    sheets: doc.sheets ?? [...REPORT_IDS],
    paper: doc.paper,
    createdAt: doc.createdAt.toISOString(),
    storage: doc.storage,
    files: doc.files.map(({ kind, name, size }) => ({ kind, name, size })),
    summary: doc.summary,
  };
}

function uid(request: FastifyRequest): ObjectId {
  if (!request.userId) throw new Error('requireUser did not run');
  return request.userId;
}

export function registerReportRoutes(app: FastifyInstance, c: Collections, holidays: HolidayService, services: ReportServices) {
  const auth = { preHandler: app.requireUser };

  app.post(
    '/api/reports',
    { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { from, to, paper, sheets: requested } = generateSchema.parse(request.body);
      if (!services.renderer) return reply.code(503).send({ error: 'PDF generation is not available on this server' });
      const userId = uid(request);
      const data = await loadUserData(c, holidays, userId, [from, to]);
      const settings = { ...data.settings, paperSize: paper };
      const summary = buildPeriodSummary(from, to, { ...data, settings });
      const sheets = REPORT_IDS.filter((id) => !requested || requested.includes(id));
      const models = buildAllReports(summary, settings, sheets);
      const month = summary.month;
      const centre = `AWC_${safeFilePart(settings.center.number)}`;
      const label = sheets.length === REPORT_IDS.length ? 'ICDS_Reports' : sheets.length === 1 ? SHEET_FILE[sheets[0]] : `ICDS_Reports_${sheets.join('-')}`;
      const base = `${centre}_${label}_${periodSlug(summary)}_${paper}`;

      const [pdf, xlsx] = await Promise.all([
        services.renderer.render(reportsDocument(models, paper, services.fontCss(), base)),
        workbookBlob(models, paper).then(async (blob) => Buffer.from(await blob.arrayBuffer())),
      ]);

      const id = new ObjectId();
      const prefix = `users/${userId.toHexString()}/${month}/${id.toHexString()}`;
      const files: ReportFile[] = [
        { kind: 'pdf', key: `${prefix}/${base}.pdf`, name: `${base}.pdf`, size: pdf.length, contentType: 'application/pdf' },
        { kind: 'xlsx', key: `${prefix}/${base}.xlsx`, name: `${base}.xlsx`, size: xlsx.length, contentType: XLSX_TYPE },
      ];
      await services.storage.put(files[0].key, pdf, files[0].contentType);
      await services.storage.put(files[1].key, xlsx, files[1].contentType);

      const doc: ReportDoc = {
        _id: id,
        userId,
        month,
        from,
        to,
        sheets,
        paper,
        createdAt: new Date(),
        storage: services.storage.kind,
        files,
        summary: {
          servedDays: summary.servedDays,
          beneficiaryDays: summary.beneficiaryDays,
          purchaseTotal: summary.purchaseTotal,
          fuelTotal: summary.fuelTotal,
        },
      };
      await c.reports.insertOne(doc);
      return reply.code(201).send(publicReport(doc));
    },
  );

  app.get('/api/reports', auth, async (request) => {
    const { month } = listSchema.parse(request.query);
    const docs = await c.reports
      .find({ userId: uid(request), ...(month ? { month } : {}) })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return docs.map(publicReport);
  });

  app.get('/api/reports/:id/files/:kind', auth, async (request, reply) => {
    const { id, kind } = fileParams.parse(request.params);
    const inline = (request.query as { inline?: string }).inline === '1';
    const doc = await c.reports.findOne({ _id: new ObjectId(id), userId: uid(request) });
    const file = doc?.files.find((f) => f.kind === kind);
    if (!doc || !file) return reply.code(404).send({ error: 'Report not found' });
    const stream = await services.storage.get(file.key);
    const ascii = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    return reply
      .header('Content-Type', file.contentType)
      .header('Content-Length', String(file.size))
      .header('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`)
      .send(stream);
  });

  app.delete('/api/reports/:id', auth, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const doc = await c.reports.findOne({ _id: new ObjectId(id), userId: uid(request) });
    if (!doc) return reply.code(404).send({ error: 'Report not found' });
    await services.storage.remove(doc.files.map((f) => f.key));
    await c.reports.deleteOne({ _id: doc._id });
    return reply.code(204).send();
  });
}
