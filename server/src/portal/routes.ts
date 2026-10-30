import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sessionUserId } from '../auth';
import type { Collections } from '../db';
import { seal, unseal } from './crypto';

const loginSchema = z.strictObject({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(100),
});

/** The worker's Poshan Abhiyaan login, read back in full so the app can offer it for copying. */
export function registerPortalLoginRoutes(app: FastifyInstance, c: Collections, secret: Buffer | undefined) {
  const guarded = { preHandler: app.requireUser, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

  app.get('/api/portal-login', guarded, async (request) => {
    const userId = sessionUserId(request);
    if (!secret) return { available: false, login: null };
    const doc = await c.portalLogins.findOne({ userId });
    if (!doc) return { available: true, login: null };
    try {
      return { available: true, login: { username: doc.username, password: unseal(secret, doc.password, userId.toHexString()) } };
    } catch {
      request.log.warn('Saved portal login could not be decrypted (PORTAL_SECRET changed?)');
      return { available: true, login: null };
    }
  });

  app.put('/api/portal-login', guarded, async (request, reply) => {
    const userId = sessionUserId(request);
    const body = loginSchema.parse(request.body);
    if (!secret) return reply.code(503).send({ error: 'Saving the portal login is not set up on this server' });
    await c.portalLogins.updateOne(
      { userId },
      { $set: { username: body.username, password: seal(secret, body.password, userId.toHexString()), updatedAt: new Date() } },
      { upsert: true },
    );
    return reply.code(204).send();
  });

  app.delete('/api/portal-login', guarded, async (request, reply) => {
    await c.portalLogins.deleteOne({ userId: sessionUserId(request) });
    return reply.code(204).send();
  });
}
