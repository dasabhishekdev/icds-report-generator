import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { MongoClient, type Db } from 'mongodb';
import { buildApp } from '../src/app';
import { SESSION_COOKIE } from '../src/auth';
import type { Config } from '../src/config';
import { diskStorage, type ReportStorage } from '../src/reports/storage';

export const MONGO_URL = process.env.MONGO_URL;

type Method = 'GET' | 'PUT' | 'POST' | 'DELETE';

export interface TestApp {
  app: FastifyInstance;
  db: Db;
  register: (login: string, centreNumber?: string) => Promise<string>;
  call: (cookie: string, method: Method, url: string, payload?: unknown) => Promise<LightMyRequestResponse>;
  close: () => Promise<void>;
}

/** A fresh database and app per test file; needs MONGO_URL. */
export async function startTestApp(options: { config?: Partial<Config>; storage?: ReportStorage } = {}): Promise<TestApp> {
  const client = new MongoClient(MONGO_URL!, { ignoreUndefined: true });
  await client.connect();
  const db = client.db(`icds-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const app = await buildApp(
    db,
    { port: 0, mongoUrl: MONGO_URL!, cookieSecure: false, allowRegistration: true, fontDir: '', reportsDir: '', ...options.config },
    { reports: { storage: options.storage ?? diskStorage('tmp/test-unused'), renderer: null, fontCss: () => '' } },
  );

  const register = async (login: string, centreNumber = '547') => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { login, password: 'correct horse', name: 'Worker', center: { name: 'Test Centre', number: centreNumber } },
    });
    const c = res.cookies.find((x) => x.name === SESSION_COOKIE);
    if (!c) throw new Error(`No session cookie (status ${res.statusCode}: ${res.body})`);
    return `${SESSION_COOKIE}=${c.value}`;
  };
  const call = (cookie: string, method: Method, url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, payload: payload as object });

  return {
    app,
    db,
    register,
    call,
    close: async () => {
      await app.close();
      await db.dropDatabase();
      await client.close();
    },
  };
}
