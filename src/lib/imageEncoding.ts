export interface Dims {
  width: number;
  height: number;
}

export const ENCODING_LIMITS = {
  /** Bytes; the Poshan portal refuses files over 2,000,000 bytes. */
  maxOutput: 1_500_000,
  minQuality: 0.8,
  maxQuality: 0.95,
  /** Only used once the photo is already down to `minLongSide`. */
  floorQuality: 0.5,
  /** Longest side in pixels — what the portal itself keeps. */
  minLongSide: 1920,
  /** iOS Safari cannot draw canvases larger than this. */
  maxCanvasPixels: 16_777_216,
};

export type EncodingLimits = typeof ENCODING_LIMITS;

export class EncodingError extends Error {}

const SEARCH_STEPS = 6;
const MAX_RESIZES = 6;

const scaled = (d: Dims, factor: number): Dims => ({
  width: Math.max(1, Math.round(d.width * factor)),
  height: Math.max(1, Math.round(d.height * factor)),
});

export function fitCanvas(d: Dims, maxPixels: number): Dims {
  if (d.width * d.height <= maxPixels) return d;
  const factor = Math.sqrt(maxPixels / (d.width * d.height));
  return { width: Math.max(1, Math.floor(d.width * factor)), height: Math.max(1, Math.floor(d.height * factor)) };
}

/** Shrinks (never enlarges) so the longest side is `longSide`. */
export function scaleToLongSide(d: Dims, longSide: number): Dims {
  const long = Math.max(d.width, d.height);
  return long <= longSide ? d : scaled(d, longSide / long);
}

type Encode<T> = (width: number, height: number, quality: number) => Promise<T>;

/** Highest quality in [lo, hi] whose output fits, or null with the size at `lo`. */
async function bestQuality<T extends { size: number }>(d: Dims, lo: number, hi: number, encode: Encode<T>, max: number) {
  const top = await encode(d.width, d.height, hi);
  if (top.size <= max) return { fit: { result: top, quality: hi }, sizeAtLo: top.size };
  const bottom = await encode(d.width, d.height, lo);
  if (bottom.size > max) return { fit: null, sizeAtLo: bottom.size };
  let best = { result: bottom, quality: lo };
  for (let i = 0; i < SEARCH_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const r = await encode(d.width, d.height, mid);
    if (r.size <= max) {
      best = { result: r, quality: mid };
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { fit: best, sizeAtLo: bottom.size };
}

/**
 * Picks the largest dimensions and highest JPEG quality whose output is at most `maxOutput` bytes:
 * full size when quality stays at or above `minQuality`, otherwise just enough downscaling,
 * never below `minLongSide`.
 */
export async function chooseEncoding<T extends { size: number }>(
  original: Dims,
  encode: Encode<T>,
  limits: EncodingLimits = ENCODING_LIMITS,
): Promise<{ result: T; width: number; height: number; quality: number }> {
  let d = fitCanvas(original, limits.maxCanvasPixels);
  for (let i = 0; i < MAX_RESIZES; i++) {
    const { fit, sizeAtLo } = await bestQuality(d, limits.minQuality, limits.maxQuality, encode, limits.maxOutput);
    if (fit) return { ...fit, ...d };
    const long = Math.max(d.width, d.height);
    if (long <= limits.minLongSide) break;
    const target = Math.max(limits.minLongSide, Math.floor(long * Math.sqrt(limits.maxOutput / sizeAtLo) * 0.95));
    d = scaleToLongSide(d, target);
  }
  const { fit } = await bestQuality(d, limits.floorQuality, limits.minQuality, encode, limits.maxOutput);
  if (fit) return { ...fit, ...d };
  throw new EncodingError('The photo cannot be made small enough');
}
