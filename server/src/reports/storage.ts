import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface ReportStorage {
  readonly kind: 's3' | 'disk';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Readable>;
  remove(keys: string[]): Promise<void>;
}

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
  prefix: string;
}

/** Keys are built by the server from ObjectIds, months and fixed names — never from user text. */
const SAFE_KEY = /^[A-Za-z0-9/_.-]+$/;
function assertKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error(`Unsafe storage key: ${key}`);
}

export function s3Storage(cfg: S3Config): ReportStorage {
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    credentials: cfg.accessKeyId && cfg.secretAccessKey ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } : undefined,
  });
  const full = (key: string) => (cfg.prefix ? `${cfg.prefix}/${key}` : key);
  return {
    kind: 's3',
    async put(key, body, contentType) {
      assertKey(key);
      await client.send(
        new PutObjectCommand({ Bucket: cfg.bucket, Key: full(key), Body: body, ContentType: contentType, ServerSideEncryption: cfg.endpoint ? undefined : 'AES256' }),
      );
    },
    async get(key) {
      assertKey(key);
      const res = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: full(key) }));
      return res.Body as Readable;
    },
    async remove(keys) {
      keys.forEach(assertKey);
      if (!keys.length) return;
      await client.send(new DeleteObjectsCommand({ Bucket: cfg.bucket, Delete: { Objects: keys.map((k) => ({ Key: full(k) })) } }));
    },
  };
}

/** Fallback when no S3 bucket is configured: files live in a Docker volume on the server. */
export function diskStorage(root: string): ReportStorage {
  const base = resolve(root);
  const pathOf = (key: string) => {
    assertKey(key);
    const p = resolve(base, key);
    if (!p.startsWith(base + sep)) throw new Error(`Unsafe storage key: ${key}`);
    return p;
  };
  return {
    kind: 'disk',
    async put(key, body) {
      const p = pathOf(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, body);
    },
    async get(key) {
      return createReadStream(pathOf(key));
    },
    async remove(keys) {
      await Promise.all(keys.map((k) => rm(pathOf(k), { force: true })));
    },
  };
}
