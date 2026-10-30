import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { photoFileName, photoMonth } from '../../../src/domain/photoName';
import { sessionUserId } from '../auth';
import type { Collections, PhotoDoc } from '../db';
import type { ReportStorage } from '../reports/storage';
import { monthSchema } from '../schemas';

/** The Poshan portal refuses larger files. */
const MAX_IMAGE_BYTES = 2_000_000;
const MAX_THUMB_BYTES = 100_000;
const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;

const SIGNATURES = {
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
} as const;

const pixels = z.int().min(1).max(100_000);
const base64Of = (maxBytes: number) => z.base64().max(Math.ceil(maxBytes / 3) * 4 + 8);

const uploadSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  contentType: z.enum(['image/jpeg', 'image/png']),
  width: pixels,
  height: pixels,
  originalSize: z.int().min(1).max(MAX_ORIGINAL_BYTES),
  originalWidth: pixels,
  originalHeight: pixels,
  image: base64Of(MAX_IMAGE_BYTES),
  thumb: base64Of(MAX_THUMB_BYTES),
});
const listSchema = z.strictObject({ month: monthSchema.optional() });
const idParams = z.strictObject({ id: z.string().regex(/^[a-f0-9]{24}$/) });

const startsWith = (buf: Buffer, signature: Buffer) => buf.length > signature.length && buf.subarray(0, signature.length).equals(signature);

export function publicPhoto(doc: PhotoDoc) {
  return {
    id: doc._id.toHexString(),
    month: doc.month,
    name: doc.name,
    contentType: doc.contentType,
    size: doc.size,
    width: doc.width,
    height: doc.height,
    originalSize: doc.originalSize,
    originalWidth: doc.originalWidth,
    originalHeight: doc.originalHeight,
    capturedAt: doc.capturedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    storage: doc.storage,
  };
}

export function registerPhotoRoutes(app: FastifyInstance, c: Collections, storage: ReportStorage) {
  const auth = { preHandler: app.requireUser };

  app.post(
    '/api/photos',
    { ...auth, bodyLimit: 3 * 1024 * 1024, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = uploadSchema.parse(request.body);
      const image = Buffer.from(body.image, 'base64');
      const thumb = Buffer.from(body.thumb, 'base64');
      if (image.length > MAX_IMAGE_BYTES) return reply.code(400).send({ error: 'The photo must be 2 MB or smaller' });
      if (!startsWith(image, SIGNATURES[body.contentType])) return reply.code(400).send({ error: 'The photo is not a valid JPEG or PNG' });
      if (thumb.length > MAX_THUMB_BYTES || !startsWith(thumb, SIGNATURES['image/jpeg'])) {
        return reply.code(400).send({ error: 'The thumbnail is not a valid JPEG' });
      }

      const userId = sessionUserId(request);
      const settings = await c.settings.findOne({ userId }, { projection: { center: 1 } });
      const capturedAt = new Date(body.capturedAt);
      const month = photoMonth(capturedAt);
      const name = photoFileName(settings?.center.number ?? '', capturedAt, body.contentType);
      const id = new ObjectId();
      const prefix = `users/${userId.toHexString()}/photos/${month}/${id.toHexString()}`;
      const doc: PhotoDoc = {
        _id: id,
        userId,
        month,
        name,
        contentType: body.contentType,
        size: image.length,
        width: body.width,
        height: body.height,
        originalSize: body.originalSize,
        originalWidth: body.originalWidth,
        originalHeight: body.originalHeight,
        capturedAt,
        createdAt: new Date(),
        storage: storage.kind,
        key: `${prefix}/${name}`,
        thumbKey: `${prefix}/thumb.jpg`,
      };
      await storage.put(doc.key, image, doc.contentType);
      await storage.put(doc.thumbKey, thumb, 'image/jpeg');
      await c.photos.insertOne(doc);
      return reply.code(201).send(publicPhoto(doc));
    },
  );

  app.get('/api/photos', auth, async (request) => {
    const { month } = listSchema.parse(request.query);
    const docs = await c.photos
      .find({ userId: sessionUserId(request), ...(month ? { month } : {}) })
      .sort({ capturedAt: -1 })
      .limit(200)
      .toArray();
    return docs.map(publicPhoto);
  });

  for (const part of ['file', 'thumb'] as const) {
    app.get(`/api/photos/:id/${part}`, auth, async (request, reply) => {
      const { id } = idParams.parse(request.params);
      const doc = await c.photos.findOne({ _id: new ObjectId(id), userId: sessionUserId(request) });
      if (!doc) return reply.code(404).send({ error: 'Photo not found' });
      if (part === 'thumb') return reply.header('Content-Type', 'image/jpeg').send(await storage.get(doc.thumbKey));
      return reply
        .header('Content-Type', doc.contentType)
        .header('Content-Length', String(doc.size))
        .header('Content-Disposition', `attachment; filename="${doc.name}"`)
        .send(await storage.get(doc.key));
    });
  }

  app.delete('/api/photos/:id', auth, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const doc = await c.photos.findOne({ _id: new ObjectId(id), userId: sessionUserId(request) });
    if (!doc) return reply.code(404).send({ error: 'Photo not found' });
    await storage.remove([doc.key, doc.thumbKey]);
    await c.photos.deleteOne({ _id: doc._id });
    return reply.code(204).send();
  });
}
