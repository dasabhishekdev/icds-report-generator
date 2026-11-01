import type { PhotoContentType } from '../domain/photoName';
import type { CompressedPhoto } from '../lib/compressPhoto';
import type { GeoFix } from '../lib/geolocation';
import { api } from './http';

export interface StoredPhoto {
  id: string;
  month: string;
  name: string;
  contentType: PhotoContentType;
  size: number;
  width: number;
  height: number;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  capturedAt: string;
  location?: GeoFix;
  createdAt: string;
  storage: 's3' | 'disk';
}

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const photosApi = {
  list: (month?: string) => api<StoredPhoto[]>('GET', `/api/photos${month ? `?month=${month}` : ''}`),
  upload: async (photo: CompressedPhoto, capturedAt: Date, location: GeoFix | null) =>
    api<StoredPhoto>('POST', '/api/photos', {
      capturedAt: capturedAt.toISOString(),
      contentType: photo.contentType,
      width: photo.width,
      height: photo.height,
      originalSize: photo.originalSize,
      originalWidth: photo.originalWidth,
      originalHeight: photo.originalHeight,
      image: await base64(photo.image),
      thumb: await base64(photo.thumb),
      ...(location ? { location } : {}),
    }),
  remove: (id: string) => api<void>('DELETE', `/api/photos/${id}`),
  fileUrl: (id: string) => `/api/photos/${id}/file`,
  thumbUrl: (id: string) => `/api/photos/${id}/thumb`,
};
