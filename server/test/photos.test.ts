import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { diskStorage } from '../src/reports/storage';
import { MONGO_URL, startTestApp, type TestApp } from './helpers';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const bytes = (signature: Buffer, size: number) => Buffer.concat([signature, Buffer.alloc(size - signature.length, 7)]);

const upload = (image: Buffer, overrides: Record<string, unknown> = {}) => ({
  capturedAt: '2026-10-31T19:00:00.000Z',
  contentType: 'image/jpeg',
  width: 4000,
  height: 3000,
  originalSize: 9_800_000,
  originalWidth: 4000,
  originalHeight: 3000,
  image: image.toString('base64'),
  thumb: bytes(JPEG, 2_000).toString('base64'),
  ...overrides,
});

describe.skipIf(!MONGO_URL)('Jan Andolan photos', () => {
  let t: TestApp;
  let dir: string;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'icds-photos-'));
    t = await startTestApp({ storage: diskStorage(dir) });
  });
  afterAll(async () => {
    await t?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('stores, lists, downloads and deletes a photo', async () => {
    const owner = await t.register(`photo-${Math.random()}@test.in`, '547');
    const image = bytes(JPEG, 1_400_000);
    const created = await t.call(owner, 'POST', '/api/photos', upload(image));
    expect(created.statusCode).toBe(201);
    const photo = created.json();
    expect(photo).toMatchObject({
      month: '2026-11',
      name: 'AWC_547_JanAndolan_2026-11-01_0030.jpg',
      contentType: 'image/jpeg',
      size: image.length,
      width: 4000,
      originalSize: 9_800_000,
      capturedAt: '2026-10-31T19:00:00.000Z',
      storage: 'disk',
    });

    expect((await t.call(owner, 'GET', '/api/photos?month=2026-11')).json().map((p: { id: string }) => p.id)).toEqual([photo.id]);
    expect((await t.call(owner, 'GET', '/api/photos?month=2026-10')).json()).toEqual([]);

    const file = await t.call(owner, 'GET', `/api/photos/${photo.id}/file`);
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
    expect(String(file.headers['content-disposition'])).toMatch(/^attachment; filename="AWC_547_JanAndolan_2026-11-01_0030\.jpg"/);
    expect(file.rawPayload.equals(image)).toBe(true);

    const thumb = await t.call(owner, 'GET', `/api/photos/${photo.id}/thumb`);
    expect(thumb.statusCode).toBe(200);
    expect(thumb.rawPayload.length).toBe(2_000);

    const userId = (await t.call(owner, 'GET', '/api/auth/me')).json().user.id;
    const key = `users/${userId}/photos/2026-11/${photo.id}/${photo.name}`;
    expect(existsSync(join(dir, key))).toBe(true);

    const intruder = await t.register(`intruder-${Math.random()}@test.in`);
    expect((await t.call(intruder, 'GET', `/api/photos/${photo.id}/file`)).statusCode).toBe(404);
    expect((await t.call(intruder, 'DELETE', `/api/photos/${photo.id}`)).statusCode).toBe(404);
    expect((await t.call(intruder, 'GET', '/api/photos')).json()).toEqual([]);

    expect((await t.call(owner, 'DELETE', `/api/photos/${photo.id}`)).statusCode).toBe(204);
    expect((await t.call(owner, 'GET', `/api/photos/${photo.id}/file`)).statusCode).toBe(404);
    expect(existsSync(join(dir, key))).toBe(false);
  });

  it('keeps a small PNG as .png', async () => {
    const cookie = await t.register(`png-${Math.random()}@test.in`, '12');
    const res = await t.call(cookie, 'POST', '/api/photos', upload(bytes(PNG, 50_000), { contentType: 'image/png' }));
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('AWC_12_JanAndolan_2026-11-01_0030.png');
  });

  it('saves the GPS location stamped on a photo', async () => {
    const cookie = await t.register(`geo-${Math.random()}@test.in`, '547');
    const location = { lat: 22.97321, lng: 88.43211, accuracy: 12 };
    const res = await t.call(cookie, 'POST', '/api/photos', upload(bytes(JPEG, 5_000), { location }));
    expect(res.statusCode).toBe(201);
    expect(res.json().location).toEqual(location);
    expect((await t.call(cookie, 'GET', '/api/photos')).json()[0].location).toEqual(location);
    expect((await t.call(cookie, 'POST', '/api/photos', upload(bytes(JPEG, 5_000), { location: { lat: 99, lng: 88, accuracy: 5 } }))).statusCode).toBe(400);
  });

  it('rejects oversized, mislabelled and malformed uploads', async () => {
    const cookie = await t.register(`bad-${Math.random()}@test.in`);
    const post = (body: unknown) => t.call(cookie, 'POST', '/api/photos', body).then((r) => r.statusCode);
    expect(await post(upload(bytes(JPEG, 2_000_001)))).toBe(400);
    expect(await post(upload(bytes(PNG, 1000)))).toBe(400);
    expect(await post(upload(bytes(JPEG, 1000), { contentType: 'image/png' }))).toBe(400);
    expect(await post(upload(bytes(JPEG, 1000), { contentType: 'image/gif' }))).toBe(400);
    expect(await post(upload(bytes(JPEG, 1000), { thumb: bytes(PNG, 1000).toString('base64') }))).toBe(400);
    expect(await post(upload(bytes(JPEG, 1000), { image: 'not base64!' }))).toBe(400);
    expect(await post(upload(bytes(JPEG, 1000), { capturedAt: 'yesterday' }))).toBe(400);
    expect(await post(upload(bytes(JPEG, 1000), { name: '../../etc/passwd' }))).toBe(400);
    expect((await t.call(cookie, 'GET', '/api/photos/not-an-id/file')).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'GET', url: '/api/photos' })).statusCode).toBe(401);
  });
});
