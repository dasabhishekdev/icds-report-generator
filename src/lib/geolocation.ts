export interface GeoFix {
  lat: number;
  lng: number;
  /** Metres. */
  accuracy: number;
}

export type LocationPermission = PermissionState | 'unsupported';

/** Why no fix: permission refused, GPS off / no signal, too slow, or no geolocation at all. */
export type LocationFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported';
export type LocationResult = { ok: true; fix: GeoFix } | { ok: false; reason: LocationFailure };

/** Current permission state without prompting; 'prompt' when the browser cannot tell. */
export async function locationPermission(): Promise<LocationPermission> {
  if (!('geolocation' in navigator)) return 'unsupported';
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return 'prompt';
  }
}

/** A fresh GPS fix; asks for permission (browser or Android dialog) when not yet decided. */
export function requestLocation(timeoutMs = 20_000): Promise<LocationResult> {
  if (!('geolocation' in navigator)) return Promise.resolve({ ok: false, reason: 'unsupported' });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, fix: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) } }),
      (err) =>
        resolve({
          ok: false,
          reason: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable',
        }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

export const mapsUrl = (fix: Pick<GeoFix, 'lat' | 'lng'>) => `https://www.google.com/maps?q=${fix.lat.toFixed(6)},${fix.lng.toFixed(6)}`;

/** "Lat 22.973210, Long 88.432110 (±12 m)" as stamped on photos. */
export const formatFix = (fix: GeoFix) => `Lat ${fix.lat.toFixed(6)}, Long ${fix.lng.toFixed(6)} (±${fix.accuracy} m)`;
