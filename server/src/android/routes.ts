import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ReportStorage } from '../reports/storage';

/** Published with the APK by scripts/publish-android.ts; the bucket stays private and the API streams the file. */
export const ANDROID_LATEST_KEY = 'android/latest.json';
export const apkKey = (versionName: string) => `android/ICDS-Reports-${versionName}.apk`;

const releaseSchema = z.strictObject({
  versionCode: z.int().min(1),
  versionName: z.string().regex(/^\d+\.\d+\.\d+$/),
  size: z.int().min(1),
  publishedAt: z.iso.datetime(),
});
export type AndroidRelease = z.infer<typeof releaseSchema>;

const CACHE_MS = 5 * 60 * 1000;

async function readJson(storage: ReportStorage, key: string): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of await storage.get(key)) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function registerAndroidRoutes(app: FastifyInstance, storage: ReportStorage) {
  let cached: { release: AndroidRelease | null; at: number } | null = null;
  const latest = async (): Promise<AndroidRelease | null> => {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.release;
    let release: AndroidRelease | null = null;
    try {
      release = releaseSchema.parse(await readJson(storage, ANDROID_LATEST_KEY));
    } catch (e) {
      app.log.warn({ err: e }, 'No Android release published');
    }
    cached = { release, at: Date.now() };
    return release;
  };
  const limited = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

  app.get('/api/android/latest', limited, async (_request, reply) => {
    const release = await latest();
    if (!release) return reply.code(404).send({ error: 'No Android app published yet' });
    return reply.header('Cache-Control', 'no-cache').send({ ...release, downloadUrl: '/api/android/download' });
  });

  app.get('/api/android/download', limited, async (_request, reply) => {
    const release = await latest();
    if (!release) return reply.code(404).send({ error: 'No Android app published yet' });
    const name = `ICDS-Reports-${release.versionName}.apk`;
    return reply
      .header('Content-Type', 'application/vnd.android.package-archive')
      .header('Content-Length', String(release.size))
      .header('Content-Disposition', `attachment; filename="${name}"`)
      .header('Cache-Control', 'no-cache')
      .send(await storage.get(apkKey(release.versionName)));
  });
}
