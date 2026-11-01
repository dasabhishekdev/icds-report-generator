import { CalendarCheck, CalendarDays, FileSpreadsheet, IndianRupee, Package, Smartphone, type LucideIcon } from 'lucide-react';
import type { StringKey } from '../i18n/strings';

type T = (key: StringKey) => string;

const FEATURES: { icon: LucideIcon; title: StringKey; text: StringKey }[] = [
  { icon: CalendarCheck, title: 'featAttendanceTitle', text: 'featAttendance' },
  { icon: IndianRupee, title: 'featRationTitle', text: 'featRation' },
  { icon: FileSpreadsheet, title: 'featRegistersTitle', text: 'featRegisters' },
  { icon: Package, title: 'featStockTitle', text: 'featStock' },
  { icon: CalendarDays, title: 'featHolidaysTitle', text: 'featHolidays' },
  { icon: Smartphone, title: 'featPhoneTitle', text: 'featPhone' },
];

/** Screenshots of the app and registers with the real September 2026 data of AWC 547 (personal names replaced). */
const PHONE_SHOTS: { src: string; caption: StringKey }[] = [
  { src: '/showcase/app-attendance.webp', caption: 'shotAttendance' },
  { src: '/showcase/app-month.webp', caption: 'shotMonth' },
  { src: '/showcase/app-stock.webp', caption: 'shotStock' },
  { src: '/showcase/app-reports.webp', caption: 'shotReports' },
];

/** Landscape registers span both columns so their small print stays readable. */
const REGISTER_SHOTS: { src: string; caption: StringKey; width: number; height: number; wide?: boolean }[] = [
  { src: '/showcase/voucher.webp', caption: 'shotVoucher', width: 894, height: 571 },
  { src: '/showcase/fuel-register.webp', caption: 'shotFuel', width: 1098, height: 1150 },
  { src: '/showcase/snp-register.webp', caption: 'shotSnp', width: 1400, height: 652, wide: true },
  { src: '/showcase/stock-register.webp', caption: 'shotStockRegister', width: 1600, height: 419, wide: true },
];

export function ShowcaseIntro({ t }: { t: T }) {
  return (
    <section className="text-white">
      <h1 className="text-2xl leading-tight font-bold sm:text-3xl">{t('landingTitle')}</h1>
      <p className="mt-3 text-base text-teal-50">{t('landingIntro')}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
            <Icon size={22} className="mt-0.5 shrink-0 text-teal-200" aria-hidden />
            <span>
              <span className="block font-semibold">{t(title)}</span>
              <span className="block text-sm text-teal-100">{t(text)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ShowcaseGallery({ t }: { t: T }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-xl sm:p-6">
      <h2 className="text-xl font-bold text-slate-900">{t('realDataTitle')}</h2>
      <p className="mt-1 text-sm text-slate-600">{t('realDataHint')}</p>

      <h3 className="mt-5 mb-3 text-sm font-bold tracking-wide text-teal-800 uppercase">{t('onThePhone')}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PHONE_SHOTS.map((shot) => (
          <figure key={shot.src}>
            <a href={shot.src} target="_blank" rel="noopener" title={t('openFullSize')}>
              <img
                src={shot.src}
                alt={`${t('appName')} — ${t(shot.caption)}`}
                width={400}
                height={860}
                loading="lazy"
                decoding="async"
                className="w-full rounded-2xl shadow-md ring-1 ring-slate-200"
              />
            </a>
            <figcaption className="mt-1.5 text-center text-xs font-medium text-slate-600">{t(shot.caption)}</figcaption>
          </figure>
        ))}
      </div>

      <h3 className="mt-6 mb-3 text-sm font-bold tracking-wide text-teal-800 uppercase">{t('registersPrinted')}</h3>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {REGISTER_SHOTS.map((shot) => (
          <figure key={shot.src} className={`rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200 ${shot.wide ? 'md:col-span-2' : ''}`}>
            <a href={shot.src} target="_blank" rel="noopener" title={t('openFullSize')}>
              <img
                src={shot.src}
                alt={`${t(shot.caption)} — ${t('realDataTitle')}`}
                width={shot.width}
                height={shot.height}
                loading="lazy"
                decoding="async"
                className="w-full rounded-lg bg-white"
              />
            </a>
            <figcaption className="mt-1.5 text-center text-xs font-medium text-slate-600">{t(shot.caption)}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
