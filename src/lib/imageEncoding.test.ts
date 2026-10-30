import { describe, expect, it } from 'vitest';
import { chooseEncoding, ENCODING_LIMITS, EncodingError, fitCanvas, scaleToLongSide } from './imageEncoding';

/** Output size grows with pixels and quality; `k` sets how "busy" the photo is. */
const fakeEncoder = (k: number) => {
  const calls: { w: number; h: number; q: number }[] = [];
  const encode = async (w: number, h: number, q: number) => {
    calls.push({ w, h, q });
    return { size: Math.round(w * h * q * k) };
  };
  return { encode, calls };
};

const uncapped = { ...ENCODING_LIMITS, maxCanvasPixels: Number.POSITIVE_INFINITY };

describe('chooseEncoding', () => {
  it('keeps full size at the highest quality when it fits', async () => {
    const { encode } = fakeEncoder(0.1);
    const out = await chooseEncoding({ width: 4000, height: 3000 }, encode);
    expect(out).toMatchObject({ width: 4000, height: 3000, quality: ENCODING_LIMITS.maxQuality });
    expect(out.result.size).toBeLessThanOrEqual(ENCODING_LIMITS.maxOutput);
  });

  it('finds the highest quality in range that fits at full size', async () => {
    const { encode } = fakeEncoder(0.14);
    const out = await chooseEncoding({ width: 4000, height: 3000 }, encode);
    expect(out.width).toBe(4000);
    expect(out.quality).toBeGreaterThanOrEqual(ENCODING_LIMITS.minQuality);
    expect(out.quality).toBeLessThan(ENCODING_LIMITS.maxQuality);
    expect(out.result.size).toBeLessThanOrEqual(ENCODING_LIMITS.maxOutput);
    // Close to the limit, not far below it.
    expect(out.result.size).toBeGreaterThan(ENCODING_LIMITS.maxOutput * 0.97);
  });

  it('downscales only as far as needed and keeps quality at or above the minimum', async () => {
    const { encode } = fakeEncoder(0.1);
    const out = await chooseEncoding({ width: 8000, height: 6000 }, encode, uncapped);
    expect(out.width).toBeLessThan(8000);
    expect(out.width).toBeGreaterThanOrEqual(ENCODING_LIMITS.minLongSide);
    expect(out.width / out.height).toBeCloseTo(8000 / 6000, 2);
    expect(out.quality).toBeGreaterThanOrEqual(ENCODING_LIMITS.minQuality);
    expect(out.result.size).toBeLessThanOrEqual(ENCODING_LIMITS.maxOutput);
  });

  it('applies the canvas pixel cap before encoding', async () => {
    const { encode, calls } = fakeEncoder(0.1);
    const out = await chooseEncoding({ width: 8000, height: 6000 }, encode);
    for (const c of calls) expect(c.w * c.h).toBeLessThanOrEqual(ENCODING_LIMITS.maxCanvasPixels);
    expect(out.width * out.height).toBeLessThanOrEqual(ENCODING_LIMITS.maxCanvasPixels);
  });

  it('never goes below 1920 px and lowers quality there as a last resort', async () => {
    const { encode, calls } = fakeEncoder(1);
    const out = await chooseEncoding({ width: 8000, height: 6000 }, encode, uncapped);
    expect(out.width).toBe(ENCODING_LIMITS.minLongSide);
    expect(out.height).toBe(1440);
    expect(out.quality).toBeLessThan(ENCODING_LIMITS.minQuality);
    expect(out.quality).toBeGreaterThanOrEqual(ENCODING_LIMITS.floorQuality);
    expect(out.result.size).toBeLessThanOrEqual(ENCODING_LIMITS.maxOutput);
    for (const c of calls) expect(Math.max(c.w, c.h)).toBeGreaterThanOrEqual(ENCODING_LIMITS.minLongSide);
  });

  it('does not upscale or shrink photos already smaller than 1920 px', async () => {
    const { encode, calls } = fakeEncoder(3);
    const out = await chooseEncoding({ width: 1000, height: 800 }, encode);
    expect(out).toMatchObject({ width: 1000, height: 800 });
    expect(out.quality).toBeLessThan(ENCODING_LIMITS.minQuality);
    for (const c of calls) expect([c.w, c.h]).toEqual([1000, 800]);
  });

  it('throws when nothing fits', async () => {
    const { encode } = fakeEncoder(10);
    await expect(chooseEncoding({ width: 4000, height: 3000 }, encode)).rejects.toBeInstanceOf(EncodingError);
  });
});

describe('fitCanvas and scaleToLongSide', () => {
  it('keeps dimensions under the pixel cap and the aspect ratio', () => {
    const d = fitCanvas({ width: 12000, height: 9000 }, 16_777_216);
    expect(d.width * d.height).toBeLessThanOrEqual(16_777_216);
    expect(d.width / d.height).toBeCloseTo(4 / 3, 2);
    expect(fitCanvas({ width: 4000, height: 3000 }, 16_777_216)).toEqual({ width: 4000, height: 3000 });
  });

  it('scales portrait photos by their height', () => {
    expect(scaleToLongSide({ width: 3000, height: 4000 }, 320)).toEqual({ width: 240, height: 320 });
    expect(scaleToLongSide({ width: 200, height: 100 }, 320)).toEqual({ width: 200, height: 100 });
  });
});
