/**
 * The Android app (a Trusted Web Activity) is not on the Play Store: it opens this site with
 * `?apk=<versionCode>`, and a newer APK (kept in the private S3 bucket, streamed by the API) is
 * offered when one is published. Ordinary website updates reach the app without reinstalling.
 */
const APK_VERSION_KEY = 'icds-apk-version';
const LATEST_URL = '/api/android/latest';
export const APK_DOWNLOAD_URL = '/api/android/download';

export interface AndroidRelease {
  versionCode: number;
  versionName: string;
  /** Bytes. */
  size: number;
}

const APP_REFERRER = 'android-app://com.educoreva.icds';

/**
 * Remembers the version the Android app launched with, then drops it from the address bar.
 * Version 1.0.0 opened the site without `?apk`; its launch referrer still identifies the app.
 */
export function rememberApkVersion(): void {
  const params = new URLSearchParams(window.location.search);
  const version = params.get('apk');
  if (!version) {
    if (document.referrer.startsWith(APP_REFERRER) && !localStorage.getItem(APK_VERSION_KEY)) localStorage.setItem(APK_VERSION_KEY, '1');
    return;
  }
  if (/^\d{1,6}$/.test(version)) localStorage.setItem(APK_VERSION_KEY, version);
  params.delete('apk');
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

/** 0 when not running inside the Android app. */
export const installedApkVersion = (): number => Number(localStorage.getItem(APK_VERSION_KEY)) || 0;

/** Running inside the installed Android app. */
export const inAndroidApp = () => installedApkVersion() > 0;

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
