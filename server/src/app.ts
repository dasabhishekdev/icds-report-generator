import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { Db } from 'mongodb';
import { ZodError } from 'zod';
import { registerAuth } from './auth';
import type { Config } from './config';
import { collections, ensureIndexes } from './db';
import { registerDataRoutes } from './data';
import { createHolidayService, type HolidayService } from './holidays/service';
import { registerPortalLoginRoutes } from './portal/routes';
import { embeddedFontCss } from './reports/fonts';
import { createPdfRenderer, findChrome } from './reports/pdf';
import { registerReportRoutes, type ReportServices } from './reports/routes';
import { diskStorage, s3Storage } from './reports/storage';

function defaultReportServices(config: Config): ReportServices {
  const chrome = findChrome(config.chromePath);
  let fontCss: string | null = null;
  return {
    storage: config.s3 ? s3Storage(config.s3) : diskStorage(config.reportsDir),
    renderer: chrome ? createPdfRenderer(chrome) : null,
    fontCss: () => (fontCss ??= embeddedFontCss(config.fontDir)),
  };
}

export async function buildApp(
  db: Db,
  config: Config,
  options: { logger?: boolean; reports?: ReportServices; holidays?: HolidayService } = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 10 * 1024 * 1024, trustProxy: true });
  const c = collections(db);
  await ensureIndexes(c);
  const reports = options.reports ?? defaultReportServices(config);
  const holidays =
    options.holidays ??
    createHolidayService(c.holidayCalendars, { sync: config.holidaySync ?? false, warn: (msg) => app.log.warn(msg) });
  holidays.start();
  app.addHook('onClose', async () => {
    holidays.stop();
    await reports.renderer?.close();
  });
  if (options.logger) {
    app.log.info({ storage: reports.storage.kind, pdf: Boolean(reports.renderer) }, 'report services');
  }

  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (request) => String(request.headers['x-real-ip'] ?? request.ip),
  });

  // CSRF defence in depth: cookies are SameSite=Lax and bodies must be JSON; also reject foreign origins.
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'GET' || request.method === 'HEAD') return;
    const origin = request.headers.origin;
    if (!origin) return;
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // "null" or malformed origins are treated as foreign.
    }
    if (originHost !== request.headers.host) {
      return reply.code(403).send({ error: 'Cross-origin request rejected' });
    }
  });

  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      return reply.code(400).send({ error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request' });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) request.log.error(error);
    return reply.code(status).send({ error: status >= 500 ? 'Server error' : (error as Error).message });
  });

  app.get('/api/health', async (_request, reply) => {
    try {
      await db.command({ ping: 1 });
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false });
    }
  });

  registerAuth(app, c, config);
  registerDataRoutes(app, c, holidays);
  registerReportRoutes(app, c, holidays, reports);
  registerPortalLoginRoutes(app, c, config.portalSecret);
  return app;
}
