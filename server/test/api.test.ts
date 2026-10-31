import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { MongoClient } from 'mongodb';
import { sampleData } from '../../src/db/sampleData';
import type { BackupFile } from '../../src/db/schema';
import { buildApp } from '../src/app';
import { SESSION_COOKIE } from '../src/auth';
import { diskStorage } from '../src/reports/storage';

const MONGO_URL = process.env.MONGO_URL;

/** Needs a real MongoDB: MONGO_URL=mongodb://localhost:27017 npm test */
describe.skipIf(!MONGO_URL)('API', () => {
  let client: MongoClient;
  let app: FastifyInstance;
  const dbName = `icds-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    client = new MongoClient(MONGO_URL!, { ignoreUndefined: true });
    await client.connect();
    app = await buildApp(
      client.db(dbName),
      { port: 0, mongoUrl: MONGO_URL!, cookieSecure: false, allowRegistration: true, fontDir: '', reportsDir: '' },
      { reports: { storage: diskStorage('tmp/test-unused'), renderer: null, fontCss: () => '' } },
    );
  });

  afterAll(async () => {
    await app?.close();
    await client?.db(dbName).dropDatabase();
    await client?.close();
  });

  const sessionOf = (res: LightMyRequestResponse) => {
    const c = res.cookies.find((x) => x.name === SESSION_COOKIE);
    if (!c) throw new Error(`No session cookie (status ${res.statusCode}: ${res.body})`);
    return `${SESSION_COOKIE}=${c.value}`;
  };

  const register = async (login: string, centerName = 'Centre A', number = '101') =>
    sessionOf(
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { login, password: 'correct horse', name: 'Worker ' + login, center: { name: centerName, number } },
      }),
    );

  const call = (cookie: string, method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, payload: payload as object });

  it('seeds the default injection with the user’s own centre on registration', async () => {
    const cookie = await register('alpha@example.com', 'Alpha Centre', '777');
    const res = await call(cookie, 'GET', '/api/data');
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.settings.center).toMatchObject({ name: 'Alpha Centre', number: '777', workerName: 'Worker alpha@example.com' });
    expect(data.settings.rates).toEqual({ egg: 8.5, veg: 20, potato: 28, chatu: 167 });
    expect(data.settings.language).toBe('bn');
    expect(data.categories.map((c: { id: string }) => c.id)).toEqual(['pregnant', 'nursing', 'child-0-6m', 'child-6m-3y', 'child-3y-6y']);
    expect(data.categories[3].norms.khichuri).toMatchObject({ rice: 75, egg: 0.5, veg: 20.5 });
    expect(data.beneficiaries).toEqual([]);
  });

  it('rejects anonymous access and duplicate accounts', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/data' })).statusCode).toBe(401);
    const dup = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { login: 'ALPHA@example.com', password: 'another pass', name: 'X', center: { name: 'X', number: '1' } },
    });
    expect(dup.statusCode).toBe(409);
  });

  it('keeps each user’s data separate', async () => {
    const a = await register('a@isolation.test');
    const b = await register('b@isolation.test');
    const child = { id: 'kid-1', kind: 'child', name: 'Rahul', gender: 'M', dob: '2024-01-01', enrolledOn: '2026-01-01' };
    expect((await call(a, 'PUT', '/api/beneficiaries/kid-1', child)).statusCode).toBe(200);
    expect((await call(b, 'GET', '/api/data')).json().beneficiaries).toEqual([]);
    await call(b, 'PUT', '/api/beneficiaries/kid-1', { ...child, name: 'Someone else' });
    expect((await call(a, 'GET', '/api/data')).json().beneficiaries[0].name).toBe('Rahul');
    await call(b, 'DELETE', '/api/beneficiaries/kid-1');
    expect((await call(a, 'GET', '/api/data')).json().beneficiaries).toHaveLength(1);
  });

  it('validates payloads and blocks operator injection', async () => {
    const cookie = await register('validation@test.in');
    const day = { date: '2026-09-01', status: 'working', meal: 'rice', presentIds: [], updatedAt: 1 };
    expect((await call(cookie, 'PUT', '/api/days/2026-09-01', day)).statusCode).toBe(200);
    expect((await call(cookie, 'PUT', '/api/days/2026-09-01', { ...day, status: { $ne: 'x' } })).statusCode).toBe(400);
    expect((await call(cookie, 'PUT', '/api/days/2026-09-01', { ...day, $where: '1' })).statusCode).toBe(400);
    expect((await call(cookie, 'PUT', '/api/days/2026-09-02', day)).statusCode).toBe(400);
    expect((await call(cookie, 'PATCH', '/api/settings', { userId: 'someone' })).statusCode).toBe(400);
    const foreign = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie, origin: 'https://evil.example', host: 'icds.educoreva.com' },
      payload: { nursingMonths: 3 },
    });
    expect(foreign.statusCode).toBe(403);
  });

  it('logs in, logs out and changes passwords', async () => {
    await register('login@test.in');
    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'login@test.in', password: 'nope' } });
    expect(bad.statusCode).toBe(401);
    const cookie = sessionOf(
      await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: ' Login@Test.in ', password: 'correct horse' } }),
    );
    expect((await call(cookie, 'GET', '/api/auth/me')).json().user.login).toBe('login@test.in');
    expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).json()).toEqual({ user: null });
    const changed = await call(cookie, 'POST', '/api/auth/password', { currentPassword: 'correct horse', newPassword: 'battery staple' });
    expect(changed.statusCode).toBe(200);
    expect((await call(cookie, 'GET', '/api/data')).statusCode).toBe(401);
    const fresh = sessionOf(changed);
    await call(fresh, 'POST', '/api/auth/logout');
    expect((await call(fresh, 'GET', '/api/data')).statusCode).toBe(401);
  });

  it('keeps a login for 30 days only when "Remember me" is ticked', async () => {
    await register('remember@test.in');
    const loginAs = (remember?: boolean) =>
      app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'remember@test.in', password: 'correct horse', remember } });
    const cookieOf = (res: LightMyRequestResponse) => res.cookies.find((x) => x.name === SESSION_COOKIE);

    expect(cookieOf(await loginAs())?.maxAge).toBe(30 * 24 * 3600);
    expect(cookieOf(await loginAs(true))?.maxAge).toBe(30 * 24 * 3600);
    const short = await loginAs(false);
    expect(cookieOf(short)?.maxAge).toBeUndefined();

    const changed = await call(sessionOf(short), 'POST', '/api/auth/password', { currentPassword: 'correct horse', newPassword: 'battery staple' });
    expect(changed.statusCode).toBe(200);
    expect(cookieOf(changed)?.maxAge).toBeUndefined();
    expect((await call(sessionOf(changed), 'GET', '/api/auth/me')).json().user.login).toBe('remember@test.in');
  });

  it('serves the state holiday calendar and stores holiday choices and children without a date of birth', async () => {
    const cookie = await register('holidays@test.in');
    const data = (await call(cookie, 'GET', '/api/data')).json();
    const y2026 = data.holidayCalendars.find((c: { year: number }) => c.year === 2026);
    expect(y2026?.source).toBe('built-in');
    expect(y2026.holidays).toContainEqual({ date: '2026-10-20', name: 'Durga Puja, Maha Nabami', list: 'public' });

    const patch = { stateHolidays: 'public', openOnStateHolidays: ['2026-10-20'] };
    expect((await call(cookie, 'PATCH', '/api/settings', patch)).json()).toMatchObject(patch);
    expect((await call(cookie, 'PATCH', '/api/settings', { stateHolidays: 'sometimes' })).statusCode).toBe(400);

    const noDob = { id: 'kid-x', kind: 'child', name: 'No DOB', gender: 'F', enrolledOn: '2026-01-01' };
    expect((await call(cookie, 'PUT', '/api/beneficiaries/kid-x', noDob)).statusCode).toBe(200);
    expect((await call(cookie, 'GET', '/api/data')).json().beneficiaries).toEqual([noDob]);

    const refreshed = await call(cookie, 'POST', '/api/holidays/refresh');
    expect(refreshed.statusCode).toBe(200);
    expect(Array.isArray(refreshed.json())).toBe(true);
  });

  it('loads the default setup without touching beneficiaries, attendance or the centre', async () => {
    const cookie = await register('defaults@test.in', 'Own Centre', '42');
    const child = { id: 'kid-d', kind: 'child', name: 'Ayan', gender: 'M', dob: '2024-01-01', enrolledOn: '2026-01-01' };
    const day = { date: '2026-09-01', status: 'working', meal: 'rice', presentIds: ['kid-d'], updatedAt: 1 };
    const holiday = { date: '2026-12-31', name: 'Local fair' };
    await call(cookie, 'PUT', '/api/beneficiaries/kid-d', child);
    await call(cookie, 'PUT', '/api/days/2026-09-01', day);
    await call(cookie, 'PATCH', '/api/settings', {
      rates: { egg: 9, veg: 30, potato: 30, chatu: 200 },
      weeklyOffDays: [0, 6],
      stateHolidays: 'off',
      holidays: [holiday],
    });
    const custom = (await call(cookie, 'GET', '/api/data')).json().categories[3];
    await call(cookie, 'PUT', `/api/categories/${custom.id}`, { ...custom, norms: { ...custom.norms, rice: { ...custom.norms.rice, rice: 999 } } });
    await call(cookie, 'PUT', '/api/categories/extra', { ...custom, id: 'extra', name: 'Extra', minMonths: 72, maxMonths: 84, sortOrder: 9 });

    const res = await call(cookie, 'POST', '/api/defaults');
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.settings).toMatchObject({ rates: { egg: 8.5, veg: 20, potato: 28, chatu: 167 }, weeklyOffDays: [0], stateHolidays: 'all' });
    expect(data.settings.center).toMatchObject({ name: 'Own Centre', number: '42' });
    expect(data.settings.holidays).toEqual([holiday]);
    expect(data.categories.map((c: { id: string }) => c.id)).toEqual(['pregnant', 'nursing', 'child-0-6m', 'child-6m-3y', 'child-3y-6y']);
    expect(data.categories[3].norms.rice.rice).toBe(50);
    expect(data.beneficiaries).toEqual([child]);
    expect(data.days).toEqual([day]);
  });

  it('imports a backup, protects referenced beneficiaries and resets to defaults', async () => {
    const cookie = await register('import@test.in', 'My Centre', '9');
    const sample = sampleData();
    const backup: BackupFile = { app: 'icds-report-generator', version: 1, exportedAt: new Date().toISOString(), ...sample };
    const imported = await call(cookie, 'POST', '/api/import', backup);
    expect(imported.statusCode).toBe(200);
    expect(imported.json().days).toHaveLength(27);
    expect(imported.json().beneficiaries).toHaveLength(sample.beneficiaries.length);

    const used = sample.days[0].presentIds[0];
    expect((await call(cookie, 'DELETE', `/api/beneficiaries/${used}`)).statusCode).toBe(409);
    expect((await call(cookie, 'DELETE', '/api/categories/pregnant')).statusCode).toBe(400);

    await call(cookie, 'PATCH', '/api/settings', { center: { ...sample.settings.center, name: 'Renamed' } });
    const reset = (await call(cookie, 'POST', '/api/reset')).json();
    expect(reset.days).toEqual([]);
    expect(reset.categories).toHaveLength(5);
    expect(reset.settings.center.name).toBe('Renamed');
  });
});
