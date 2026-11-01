import type { CompressRequest, CompressWorkerReply } from './compressPhoto';
import { chooseEncoding, ENCODING_LIMITS, EncodingError, scaleToLongSide, type Dims } from './imageEncoding';

const THUMB_LONG_SIDE = 320;
const THUMB_QUALITY = 0.7;

/** White text on a dark strip along the bottom, sized to the picture so it reads the same at any resolution. */
function drawStamp(ctx: OffscreenCanvasRenderingContext2D, d: Dims, lines: readonly string[]) {
  const size = Math.max(9, Math.round(Math.min(d.width, d.height) / 30));
  const pad = Math.round(size * 0.6);
  const lineHeight = Math.round(size * 1.35);
  const height = pad * 2 + lineHeight * lines.length;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, d.height - height, d.width, height);
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${size}px sans-serif`;
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, pad, d.height - height + pad + i * lineHeight, d.width - pad * 2));
}

/** Redraws only when the size changes; the quality search re-encodes the same pixels. */
function jpegEncoder(bitmap: ImageBitmap, stamp: readonly string[]) {
  let current: { key: string; canvas: OffscreenCanvas } | null = null;
  return async (d: Dims, quality: number): Promise<Blob> => {
    const key = `${d.width}x${d.height}`;
    if (current?.key !== key) {
      if (current) current.canvas.width = 0;
      const canvas = new OffscreenCanvas(d.width, d.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2D canvas');
      // JPEG has no transparency; transparent PNG areas become white instead of black.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, d.width, d.height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, d.width, d.height);
      if (stamp.length) drawStamp(ctx, d, stamp);
      current = { key, canvas };
    }
    return current.canvas.convertToBlob({ type: 'image/jpeg', quality });
  };
}

async function compress({ file, stamp }: CompressRequest): Promise<CompressWorkerReply> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, code: 'unreadable' };
  }
  try {
    const encode = jpegEncoder(bitmap, stamp);
    const original = { width: bitmap.width, height: bitmap.height };
    const thumb = await encode(scaleToLongSide(original, THUMB_LONG_SIDE), THUMB_QUALITY);
    const base = { ok: true as const, thumb, originalWidth: original.width, originalHeight: original.height, originalSize: file.size };
    // A stamped photo always has to be redrawn.
    if (!stamp.length && (file.type === 'image/jpeg' || file.type === 'image/png') && file.size <= ENCODING_LIMITS.maxOutput) {
      return { ...base, image: file, contentType: file.type, ...original, quality: null, kept: true };
    }
    const out = await chooseEncoding(original, (width, height, quality) => encode({ width, height }, quality));
    return { ...base, image: out.result, contentType: 'image/jpeg', width: out.width, height: out.height, quality: out.quality, kept: false };
  } catch (e) {
    return { ok: false, code: e instanceof EncodingError ? 'cannotFit' : 'unreadable' };
  } finally {
    bitmap.close();
  }
}

self.onmessage = async (e: MessageEvent<CompressRequest>) => {
  self.postMessage(await compress(e.data));
};
