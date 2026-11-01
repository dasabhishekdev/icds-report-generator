import { useEffect, useState } from 'react';
import { Download, LogIn, ShieldCheck, Smartphone } from 'lucide-react';
import type { Language } from '../db/schema';
import { translator } from '../i18n/lang';
import { APK_DOWNLOAD_URL, latestAndroidRelease, type AndroidRelease } from '../lib/androidApp';
import { fileSize } from '../lib/format';
import { ShowcaseGallery, ShowcaseIntro } from './Showcase';

/** Public home page of the website: what the app does, real-data screenshots, the Android download and the way in. */
export function LandingPage({ lang, onLanguage, onLogin }: { lang: Language; onLanguage: (lang: Language) => void; onLogin: () => void }) {
  const t = translator(lang);
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  useEffect(() => {
    void latestAndroidRelease().then(setRelease);
  }, []);

  const download = (
    <a
      href={APK_DOWNLOAD_URL}
      download
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-base font-semibold text-white ring-1 ring-white/40 hover:bg-white/25"
    >
      <Download size={20} /> {t('downloadAndroid')}
      {release && (
        <span className="text-sm font-normal text-teal-100">
          v{release.versionName} · {fileSize(release.size)}
        </span>
      )}
    </a>
  );

  return (
    <div className="min-h-dvh bg-gradient-to-b from-teal-700 to-teal-900 px-4 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icon.svg" alt="" className="h-11 w-11 shrink-0 rounded-2xl shadow" />
            <div className="min-w-0">
              <div className="text-lg font-bold">{t('appName')}</div>
              <div className="truncate text-sm text-teal-100">{t('authTagline')}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onLanguage(lang === 'bn' ? 'en' : 'bn')}
              className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
            >
              {lang === 'bn' ? 'English' : 'বাংলা'}
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-teal-800 shadow hover:bg-teal-50"
            >
              <LogIn size={16} /> {t('login')}
            </button>
          </div>
        </header>

        <ShowcaseIntro t={t} />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-base font-semibold text-teal-800 shadow hover:bg-teal-50"
          >
            <LogIn size={20} /> {t('loginOrRegister')}
          </button>
          {download}
        </div>

        <div className="mt-10">
          <ShowcaseGallery t={t} />
        </div>

        <section className="mt-8 rounded-3xl bg-white/10 p-5 text-white ring-1 ring-white/15 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Smartphone size={22} /> {t('androidSectionTitle')}
          </h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-teal-50">
            <li>{t('androidStep1')}</li>
            <li>{t('androidStep2')}</li>
            <li>{t('androidStep3')}</li>
          </ol>
          <p className="mt-3 flex items-start gap-2 text-sm text-teal-100">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" /> {t('androidAutoUpdate')}
          </p>
          <div className="mt-4">{download}</div>
        </section>

        <footer className="mt-8 pb-4 text-center text-xs text-teal-200">© {new Date().getFullYear()} ICDS Report Generator · icds.educoreva.com</footer>
      </div>
    </div>
  );
}
