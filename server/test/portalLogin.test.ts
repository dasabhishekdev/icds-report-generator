import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { MONGO_URL, startTestApp, type TestApp } from './helpers';

const login = { username: 'awc547.data', password: 'Portal@Pass#2026' };

describe('PORTAL_SECRET config', () => {
  it('accepts 64 hex characters and rejects anything else', () => {
    const hex = randomBytes(32).toString('hex');
    expect(loadConfig({ MONGO_URL: 'mongodb://x', PORTAL_SECRET: hex }).portalSecret).toEqual(Buffer.from(hex, 'hex'));
    expect(loadConfig({ MONGO_URL: 'mongodb://x', PORTAL_SECRET: '' }).portalSecret).toBeUndefined();
    expect(() => loadConfig({ MONGO_URL: 'mongodb://x', PORTAL_SECRET: 'short' })).toThrow(/PORTAL_SECRET/);
  });
});

describe.skipIf(!MONGO_URL)('portal login', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await startTestApp({ config: { portalSecret: randomBytes(32) } });
  });
  afterAll(() => t?.close());

  it('saves, reads back and deletes the login, encrypted at rest', async () => {
    const cookie = await t.register(`portal-${Math.random()}@test.in`);
    expect((await t.call(cookie, 'GET', '/api/portal-login')).json()).toEqual({ available: true, login: null });

    expect((await t.call(cookie, 'PUT', '/api/portal-login', login)).statusCode).toBe(204);
    expect((await t.call(cookie, 'GET', '/api/portal-login')).json()).toEqual({ available: true, login });

    const raw = JSON.stringify(await t.db.collection('portalLogins').find().toArray());
    expect(raw).toContain(login.username);
    expect(raw).not.toContain(login.password);

    expect((await t.call(cookie, 'PUT', '/api/portal-login', { ...login, password: 'second' })).statusCode).toBe(204);
    expect((await t.call(cookie, 'GET', '/api/portal-login')).json().login.password).toBe('second');

    expect((await t.call(cookie, 'DELETE', '/api/portal-login')).statusCode).toBe(204);
    expect((await t.call(cookie, 'GET', '/api/portal-login')).json().login).toBeNull();
  });

  it('keeps each account’s login to itself', async () => {
    const owner = await t.register(`owner-${Math.random()}@test.in`);
    const other = await t.register(`other-${Math.random()}@test.in`);
    await t.call(owner, 'PUT', '/api/portal-login', login);
    expect((await t.call(other, 'GET', '/api/portal-login')).json().login).toBeNull();
    await t.call(other, 'DELETE', '/api/portal-login');
    expect((await t.call(owner, 'GET', '/api/portal-login')).json().login).toEqual(login);
  });

  it('does not decrypt a login copied onto another account', async () => {
    const owner = await t.register(`copy-a-${Math.random()}@test.in`);
    const other = await t.register(`copy-b-${Math.random()}@test.in`);
    await t.call(owner, 'PUT', '/api/portal-login', login);
    await t.call(other, 'PUT', '/api/portal-login', { username: 'x', password: 'y' });
    const col = t.db.collection('portalLogins');
    const [a, b] = await Promise.all([
      col.findOne({ username: login.username }),
      col.findOne({ username: 'x' }),
    ]);
    await col.updateOne({ _id: b!._id }, { $set: { password: a!.password } });
    expect((await t.call(other, 'GET', '/api/portal-login')).json().login).toBeNull();
  });

  it('validates input and requires a session', async () => {
    const cookie = await t.register(`bad-${Math.random()}@test.in`);
    expect((await t.call(cookie, 'PUT', '/api/portal-login', { username: '  ', password: 'x' })).statusCode).toBe(400);
    expect((await t.call(cookie, 'PUT', '/api/portal-login', { username: 'u', password: '' })).statusCode).toBe(400);
    expect((await t.call(cookie, 'PUT', '/api/portal-login', { ...login, extra: 1 })).statusCode).toBe(400);
    expect((await t.call(cookie, 'PUT', '/api/portal-login', { username: 'u', password: 'p'.repeat(101) })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'GET', url: '/api/portal-login' })).statusCode).toBe(401);
  });
});

describe.skipIf(!MONGO_URL)('portal login without PORTAL_SECRET', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await startTestApp();
  });
  afterAll(() => t?.close());

  it('reports the feature as unavailable and refuses to save', async () => {
    const cookie = await t.register(`nosecret-${Math.random()}@test.in`);
    expect((await t.call(cookie, 'GET', '/api/portal-login')).json()).toEqual({ available: false, login: null });
    expect((await t.call(cookie, 'PUT', '/api/portal-login', login)).statusCode).toBe(503);
  });
});
