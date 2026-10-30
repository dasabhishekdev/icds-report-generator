import { describe, expect, it } from 'vitest';
import { photoFileName, photoMonth } from './photoName';

describe('photo file names', () => {
  it('uses India time, so a late-evening UTC photo lands on the next day', () => {
    const at = new Date('2026-10-31T19:00:00Z');
    expect(photoFileName('547', at, 'image/jpeg')).toBe('AWC_547_JanAndolan_2026-11-01_0030.jpg');
    expect(photoMonth(at)).toBe('2026-11');
  });

  it('cleans the centre number and uses .png for PNG photos', () => {
    expect(photoFileName(' 12/ক B ', new Date('2026-03-05T04:05:00Z'), 'image/png')).toBe('AWC_12_B_JanAndolan_2026-03-05_0935.png');
    expect(photoFileName('', new Date('2026-03-05T04:05:00Z'), 'image/jpeg')).toBe('AWC_centre_JanAndolan_2026-03-05_0935.jpg');
  });
});
