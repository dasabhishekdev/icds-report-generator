import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { StringKey } from '../i18n/strings';
import { APK_DOWNLOAD_URL, installedApkVersion, latestAndroidRelease, type AndroidRelease } from '../lib/androidApp';

/**
 * Inside the Android app, offers the newer APK when one is published (needed only for Android-level
 * changes). Takes `t` so it also works on the login screen, before account data is loaded.
 */
export function AppUpdateBanner({ t }: { t: (key: StringKey) => string }) {
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => {
      const installed = installedApkVersion();
      if (!installed) return;
      void latestAndroidRelease().then((latest) => setRelease(latest && latest.versionCode > installed ? latest : null));
    };
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  if (!release || dismissed) return null;
  return (
    <div role="status" className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-teal-700 px-4 py-3 text-sm text-white shadow ring-1 ring-white/20">
      <span className="min-w-0 flex-1">
        <b>{t('appUpdateTitle')}</b> {release.versionName} — {t('appUpdateHint')}
      </span>
      <a
        href={APK_DOWNLOAD_URL}
        download
        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold text-teal-800 hover:bg-teal-50"
      >
        <Download size={18} /> {t('appUpdateDownload')}
      </a>
      <button type="button" onClick={() => setDismissed(true)} className="rounded-lg p-1.5 hover:bg-white/15" aria-label={t('later')}>
        <X size={18} />
      </button>
    </div>
  );
}
