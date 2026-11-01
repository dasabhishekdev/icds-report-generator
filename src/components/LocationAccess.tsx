import { useCallback, useEffect, useState } from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import type { StringKey } from '../i18n/strings';
import { formatFix, locationPermission, requestLocation, type LocationFailure, type LocationPermission, type LocationResult } from '../lib/geolocation';
import { useApp } from '../state/AppDataContext';
import { Button } from './ui';

const DISMISS_KEY = 'icds-location-later';

export const LOCATION_FAILURE_TEXT: Record<LocationFailure, StringKey> = {
  denied: 'locationDenied',
  unavailable: 'locationUnavailable',
  timeout: 'locationTimeout',
  unsupported: 'locationUnsupported',
};

/** Permission state, refreshed when the user comes back from phone settings. */
export function useLocationPermission(): [LocationPermission | null, () => void] {
  const [state, setState] = useState<LocationPermission | null>(null);
  const refresh = useCallback(() => void locationPermission().then(setState), []);
  useEffect(() => {
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);
  return [state, refresh];
}

/**
 * Asks for location (browser prompt, or the Android dialog inside the app). `global` shows only while
 * undecided and can be put off for the session; `page` also explains how to unblock a refusal.
 */
export function LocationAccess({ variant }: { variant: 'global' | 'page' }) {
  const { t } = useApp();
  const [permission, refresh] = useLocationPermission();
  const [later, setLater] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<LocationFailure | null>(null);

  const show = variant === 'global' ? permission === 'prompt' && !later : permission === 'prompt' || permission === 'denied' || failure !== null;
  if (!show || permission === null) return null;

  async function allow() {
    setBusy(true);
    const result = await requestLocation();
    setBusy(false);
    setFailure(result.ok ? null : result.reason);
    refresh();
  }

  const message = failure ? t(LOCATION_FAILURE_TEXT[failure]) : permission === 'denied' ? t('locationDenied') : t('locationNeeded');
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-300">
      <MapPinOff size={20} className="shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {permission !== 'denied' && (
        <Button className="shrink-0" disabled={busy} onClick={() => void allow()}>
          <MapPin size={18} /> {t('allowLocation')}
        </Button>
      )}
      {variant === 'global' && (
        <Button
          variant="ghost"
          className="shrink-0"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, '1');
            setLater(true);
          }}
        >
          {t('later')}
        </Button>
      )}
    </div>
  );
}

/** Settings check: shows the permission state and tries a real GPS fix on demand. */
export function LocationCheck() {
  const { t } = useApp();
  const [permission, refresh] = useLocationPermission();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LocationResult | null>(null);
  const status: Record<LocationPermission, StringKey> = {
    granted: 'locationAllowed',
    prompt: 'locationNotAsked',
    denied: 'locationBlocked',
    unsupported: 'locationUnsupported',
  };

  async function check() {
    setBusy(true);
    setResult(await requestLocation());
    setBusy(false);
    refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-slate-700">
          {t('photoLocationLabel')}: <b>{permission ? t(status[permission]) : '…'}</b>
        </span>
        <Button disabled={busy || permission === 'unsupported'} onClick={() => void check()}>
          <MapPin size={18} /> {busy ? t('gettingLocation') : t('checkLocation')}
        </Button>
      </div>
      {result && (
        <p className={`rounded-xl px-3 py-2 text-sm ring-1 ${result.ok ? 'bg-teal-50 text-teal-900 ring-teal-200' : 'bg-amber-50 text-amber-900 ring-amber-300'}`}>
          {result.ok ? formatFix(result.fix) : t(LOCATION_FAILURE_TEXT[result.reason])}
        </p>
      )}
    </div>
  );
}
