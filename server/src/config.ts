import { join } from 'node:path';
import type { S3Config } from './reports/storage';

export interface Config {
  port: number;
  mongoUrl: string;
  cookieSecure: boolean;
  allowRegistration: boolean;
  /** Chromium/Chrome binary for Puppeteer; auto-detected when unset. */
  chromePath?: string;
  /** @fontsource/noto-sans-bengali package directory (400.css, 700.css, files/). */
  fontDir: string;
  /** Used when no S3 bucket is configured. */
  reportsDir: string;
  s3?: S3Config;
  /** Download West Bengal holiday lists from the internet; otherwise only cached and built-in lists. */
  holidaySync?: boolean;
}

const flag = (value: string | undefined, fallback: boolean) =>
  value === undefined || value === '' ? fallback : ['1', 'true', 'yes'].includes(value.toLowerCase());

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mongoUrl = env.MONGO_URL;
  if (!mongoUrl) throw new Error('MONGO_URL is required');
  return {
    port: Number(env.PORT ?? 4000),
    mongoUrl,
    cookieSecure: flag(env.COOKIE_SECURE, env.NODE_ENV === 'production'),
    allowRegistration: flag(env.ALLOW_REGISTRATION, true),
    chromePath: env.CHROME_PATH || undefined,
    fontDir: env.FONT_DIR || join(process.cwd(), 'node_modules/@fontsource/noto-sans-bengali'),
    reportsDir: env.REPORTS_DIR || join(process.cwd(), 'tmp/reports'),
    s3: env.S3_BUCKET
      ? {
          bucket: env.S3_BUCKET,
          region: env.S3_REGION || 'ap-south-1',
          endpoint: env.S3_ENDPOINT || undefined,
          accessKeyId: env.S3_ACCESS_KEY_ID || undefined,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY || undefined,
          forcePathStyle: flag(env.S3_FORCE_PATH_STYLE, false),
          prefix: (env.S3_PREFIX ?? 'icds').replace(/^\/+|\/+$/g, ''),
        }
      : undefined,
    holidaySync: flag(env.HOLIDAY_SYNC, true),
  };
}
