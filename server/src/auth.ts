import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { MongoServerError, ObjectId } from 'mongodb';
import type { Collections, UserDoc } from './db';
import type { Config } from './config';
import { loginRequestSchema, passwordChangeSchema, registerSchema } from './schemas';
import { seedUser } from './seed';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: ObjectId;
  }
}

export const SESSION_COOKIE = 'icds_session';

/** The signed-in user of a route guarded by `app.requireUser`. */
export function sessionUserId(request: FastifyRequest): ObjectId {
  if (!request.userId) throw new Error('requireUser did not run');
  return request.userId;
}
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(key, expected);
}

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');

/** Equalises timing between unknown logins and wrong passwords. */
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

const publicUser = (u: UserDoc) => ({ id: u._id.toHexString(), login: u.login, name: u.name });

export function registerAuth(app: FastifyInstance, c: Collections, config: Config) {
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 3600,
  };

  async function startSession(reply: FastifyReply, userId: ObjectId) {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await c.sessions.insertOne({
      tokenHash: sha256(token),
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_DAYS * 24 * 3600 * 1000),
    });
    reply.setCookie(SESSION_COOKIE, token, cookieOptions);
  }

  async function sessionUser(request: FastifyRequest): Promise<UserDoc | null> {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return null;
    const session = await c.sessions.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
    if (!session) return null;
    return c.users.findOne({ _id: session.userId });
  }

  app.decorate('requireUser', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await sessionUser(request);
    if (!user) return reply.code(401).send({ error: 'Please log in' });
    request.userId = user._id;
  });

  const limited = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/api/auth/register', limited, async (request, reply) => {
    if (!config.allowRegistration) return reply.code(403).send({ error: 'Registration is closed' });
    const body = registerSchema.parse(request.body);
    const user: UserDoc = {
      _id: new ObjectId(),
      login: body.login,
      name: body.name,
      passwordHash: await hashPassword(body.password),
      createdAt: new Date(),
    };
    try {
      await c.users.insertOne(user);
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        return reply.code(409).send({ error: 'An account with this email / mobile already exists' });
      }
      throw e;
    }
    await seedUser(c, user._id, { ...body.center, workerName: body.center.workerName || body.name }, { language: body.language ?? 'bn' });
    await startSession(reply, user._id);
    return reply.code(201).send({ user: publicUser(user) });
  });

  app.post('/api/auth/login', limited, async (request, reply) => {
    const body = loginRequestSchema.parse(request.body);
    const user = await c.users.findOne({ login: body.login });
    const ok = user ? await verifyPassword(body.password, user.passwordHash) : (await DUMMY_HASH, false);
    if (!user || !ok) return reply.code(401).send({ error: 'Wrong email / mobile or password' });
    await startSession(reply, user._id);
    return { user: publicUser(user) };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await c.sessions.deleteOne({ tokenHash: sha256(token) });
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  /** 200 with `user: null` when signed out, so the app's startup check is not logged as an error. */
  app.get('/api/auth/me', async (request) => {
    const user = await sessionUser(request);
    return { user: user ? publicUser(user) : null };
  });

  app.post('/api/auth/password', { ...limited, preHandler: app.requireUser }, async (request, reply) => {
    const body = passwordChangeSchema.parse(request.body);
    const user = await c.users.findOne({ _id: request.userId });
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return reply.code(400).send({ error: 'Current password is wrong' });
    }
    await c.users.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(body.newPassword) } });
    await c.sessions.deleteMany({ userId: user._id });
    await startSession(reply, user._id);
    return { ok: true };
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    requireUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
