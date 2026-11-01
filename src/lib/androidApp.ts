/**
 * The Android app (a Trusted Web Activity) is not on the Play Store: it opens this site with
 * `?apk=<versionCode>`, and a newer APK is offered from /android/latest.json when one is published.
 * Ordinary website updates reach the app without reinstalling.
 */
const APK_VERSION_KEY = 'icds-apk-version';
const LATEST_URL = '/android/latest.json';
export const APK_DOWNLOAD_URL = '/android/ICDS-Reports.apk';

export interface AndroidRelease {
  versionCode: number;
  versionName: string;
}

/** Remembers the version the Android app launched with, then drops it from the address bar. */
export function rememberApkVersion(): void {
  const params = new URLSearchParams(window.location.search);
  const version = params.get('apk');
  if (!version) return;
  if (/^\d{1,6}$/.test(version)) localStorage.setItem(APK_VERSION_KEY, version);
  params.delete('apk');
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

/** 0 when not running inside the Android app. */
export const installedApkVersion = (): number => Number(localStorage.getItem(APK_VERSION_KEY)) || 0;

export const isAndroidBrowser = () => /Android/i.test(navigator.userAgent) && installedApkVersion() === 0;

export async function latestAndroidRelease(): Promise<AndroidRelease | null> {
  try {
    const res = await fetch(LATEST_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const release = (await res.json()) as AndroidRelease;
    return Number.isInteger(release.versionCode) ? release : null;
  } catch {
    return null;
  }
}
