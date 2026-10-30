export type PhotoContentType = 'image/jpeg' | 'image/png';

/** File-name fragment from user-entered text (the centre number). */
export const safeFilePart = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'centre';

const indiaParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function india(at: Date) {
  const p = Object.fromEntries(indiaParts.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}${p.minute}` };
}

/** `AWC_<centre>_JanAndolan_<YYYY-MM-DD>_<HHmm>.jpg`, in India time; built the same way on phone and server. */
export function photoFileName(centreNumber: string, capturedAt: Date, contentType: PhotoContentType): string {
  const { date, time } = india(capturedAt);
  return `AWC_${safeFilePart(centreNumber)}_JanAndolan_${date}_${time}.${contentType === 'image/png' ? 'png' : 'jpg'}`;
}

/** YYYY-MM in India time; saved photos are listed by it. */
export const photoMonth = (capturedAt: Date) => india(capturedAt).date.slice(0, 7);
