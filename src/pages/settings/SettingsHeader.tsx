import { NavLink } from 'react-router';
import { SlidersHorizontal, UserRound } from 'lucide-react';
import type { StringKey } from '../../i18n/strings';
import { useApp } from '../../state/AppDataContext';

const SECTIONS: { to: string; label: StringKey; icon: typeof UserRound }[] = [
  { to: '/settings/account', label: 'account', icon: UserRound },
  { to: '/settings/reports', label: 'reportSettings', icon: SlidersHorizontal },
];

/** Title and the Account / Report settings switch shared by both settings pages. */
export function SettingsHeader() {
  const { t } = useApp();
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold text-slate-900 sm:text-xl">{t('navSettings')}</h1>
      <nav className="flex rounded-xl bg-slate-200/70 p-1" aria-label={t('navSettings')}>
        {SECTIONS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            replace
            className={({ isActive }) =>
              `flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition ${
                isActive ? 'bg-white text-teal-800 shadow ring-1 ring-slate-200' : 'text-slate-600'
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            <span className="truncate">{t(label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
