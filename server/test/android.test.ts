import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ANDROID_LATEST_KEY, apkKey } from '../src/android/routes';
import { diskStorage } from '../src/reports/storage';
import { MONGO_URL, startTestApp, type TestApp } from './helpers';

describe.skipIf(!MONGO_URL)('Android app download', () => {
  let t: TestApp;
  let dir: string;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'icds-android-'));
    t = await startTestApp({ storage: diskStorage(dir) });
  });
  afterAll(async () => {
    await t?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves the published APK from storage without login', async () => {
    const storage = diskStorage(dir);
    expect((await t.app.inject({ method: 'GET', url: '/api/android/latest' })).statusCode).toBe(404);

    const apk = Buffer.from('PK\u0003\u0004 fake apk');
    await storage.put(apkKey('1.0.1'), apk, 'application/vnd.android.package-archive');
    await storage.put(
      ANDROID_LATEST_KEY,
      Buffer.from(JSON.stringify({ versionCode: 2, versionName: '1.0.1', size: apk.length, publishedAt: '2026-11-01T15:00:00.000Z' })),
      'application/json',
    );
    const fresh = await startTestApp({ storage });
    try {
      const latest = await fresh.app.inject({ method: 'GET', url: '/api/android/latest' });
      expect(latest.json()).toMatchObject({ versionCode: 2, versionName: '1.0.1', size: apk.length, downloadUrl: '/api/android/download' });
      const file = await fresh.app.inject({ method: 'GET', url: '/api/android/download' });
      expect(file.statusCode).toBe(200);
      expect(file.headers['content-type']).toBe('application/vnd.android.package-archive');
      expect(String(file.headers['content-disposition'])).toBe('attachment; filename="ICDS-Reports-1.0.1.apk"');
      expect(file.rawPayload.equals(apk)).toBe(true);
    } finally {
      await fresh.close();
    }
  });
});
