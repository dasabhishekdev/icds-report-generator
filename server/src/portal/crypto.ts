import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** AES-256-GCM ciphertext, base64 fields. */
export interface SealedSecret {
  iv: string;
  tag: string;
  data: string;
}

/** `context` (the owner's id) is authenticated, so a sealed value only opens for the account it was made for. */
export function seal(key: Buffer, plain: string, context: string): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

/** Throws when the key, context or ciphertext do not match. */
export function unseal(key: Buffer, sealed: SealedSecret, context: string): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]).toString('utf8');
}
