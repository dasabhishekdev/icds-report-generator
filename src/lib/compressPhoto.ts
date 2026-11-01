import type { PhotoContentType } from '../domain/photoName';

/** Bytes; larger photos are refused before decoding. */
export const MAX_PHOTO_INPUT = 30 * 1024 * 1024;

export type PhotoErrorCode = 'tooBig' | 'unreadable' | 'cannotFit';

export class PhotoError extends Error {
  readonly code: PhotoErrorCode;

  constructor(code: PhotoErrorCode) {
    super(code);
    this.code = code;
  }
}

export interface CompressedPhoto {
  image: Blob;
  /** JPEG, longest side 320 px, for the saved-photos list. */
  thumb: Blob;
  contentType: PhotoContentType;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  /** JPEG quality used; null when the original was small enough and kept unchanged. */
  quality: number | null;
  kept: boolean;
}

/** Lines stamped along the bottom of the photo (location, time, centre); empty for none. */
export interface CompressRequest {
  file: File;
  stamp: string[];
}

export type CompressWorkerReply = ({ ok: true } & CompressedPhoto) | { ok: false; code: Exclude<PhotoErrorCode, 'tooBig'> };

/** Shrinks a photo to at most 1.5 MB in a worker, so the page stays responsive. */
export function compressPhoto(file: File, stamp: string[] = []): Promise<CompressedPhoto> {
  if (file.size > MAX_PHOTO_INPUT) return Promise.reject(new PhotoError('tooBig'));
  const worker = new Worker(new URL('./compressImage.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<CompressedPhoto>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<CompressWorkerReply>) => {
      const reply = e.data;
      if (reply.ok) resolve(reply);
      else reject(new PhotoError(reply.code));
    };
    worker.onerror = () => reject(new PhotoError('unreadable'));
    worker.postMessage({ file, stamp } satisfies CompressRequest);
  }).finally(() => worker.terminate());
}
