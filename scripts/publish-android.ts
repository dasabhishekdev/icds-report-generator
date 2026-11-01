/**
 * Uploads a signed APK to the reports bucket and makes it the version the website and the app offer.
 * Usage: npx tsx scripts/publish-android.ts <apk> <versionCode> <versionName>
 * Reads S3_* from .env (the same bucket the server uses).
 */
import { readFileSync } from 'node:fs';
import { ANDROID_LATEST_KEY, apkKey, type AndroidRelease } from '../server/src/android/routes';
import { s3Storage } from '../server/src/reports/storage';

const [apkPath, code, versionName] = process.argv.slice(2);
if (!apkPath || !/^\d+$/.test(code ?? '') || !/^\d+\.\d+\.\d+$/.test(versionName ?? '')) {
  throw new Error('Usage: npx tsx scripts/publish-android.ts <apk> <versionCode> <versionName>');
}

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
);
if (!env.S3_BUCKET) throw new Error('S3_BUCKET is not set in .env');

const storage = s3Storage({
  bucket: env.S3_BUCKET,
  region: env.S3_REGION || 'ap-south-1',
  endpoint: env.S3_ENDPOINT || undefined,
  accessKeyId: env.S3_ACCESS_KEY_ID || undefined,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY || undefined,
  forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
  // Same normalisation as server/src/config.ts, so the server finds what this uploads.
  prefix: (env.S3_PREFIX ?? 'icds').replace(/^\/+|\/+$/g, ''),
});

const apk = readFileSync(apkPath);
const release: AndroidRelease = { versionCode: Number(code), versionName, size: apk.length, publishedAt: new Date().toISOString() };
await storage.put(apkKey(versionName), apk, 'application/vnd.android.package-archive');
await storage.put(ANDROID_LATEST_KEY, Buffer.from(JSON.stringify(release, null, 2)), 'application/json');
console.log(`Published ${apkKey(versionName)} (${apk.length} bytes) as the latest Android release`);
