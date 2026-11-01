export interface GeoFix {
  lat: number;
  lng: number;
  /** Metres. */
  accuracy: number;
}

export type LocationPermission = PermissionState | 'unsupported';

/** Current permission state without prompting; 'prompt' when the browser cannot tell. */
export async function locationPermission(): Promise<LocationPermission> {
  if (!('geolocation' in navigator)) return 'unsupported';
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return 'prompt';
  }
}

/** A fresh GPS fix, or null when denied, unavailable or slower than `timeoutMs`. Prompts if not yet allowed. */
export function currentLocation(timeoutMs = 15_000): Promise<GeoFix | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

export const mapsUrl = (fix: Pick<GeoFix, 'lat' | 'lng'>) => `https://www.google.com/maps?q=${fix.lat.toFixed(6)},${fix.lng.toFixed(6)}`;

/** "Lat 22.973210, Long 88.432110 (±12 m)" as stamped on photos. */
export const formatFix = (fix: GeoFix) => `Lat ${fix.lat.toFixed(6)}, Long ${fix.lng.toFixed(6)} (±${fix.accuracy} m)`;
