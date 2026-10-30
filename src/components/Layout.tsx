import { NavLink, Outlet } from 'react-router';
import { CalendarDays, Camera, ClipboardCheck, FileSpreadsheet, LogOut, Settings, Users } from 'lucide-react';
import { useApp } from '../state/AppDataContext';
import type { StringKey } from '../i18n/strings';

const NAV: { to: string; label: StringKey; icon: typeof Users }[] = [
  { to: '/', label: 'navAttendance', icon: ClipboardCheck },
  { to: '/month', label: 'navMonth', icon: CalendarDays },
  { to: '/people', label: 'navPeople', icon: Users },
  { to: '/reports', label: 'navReports', icon: FileSpreadsheet },
  { to: '/jan-andolan', label: 'navJanAndolan', icon: Camera },
  { to: '/settings', label: 'navSettings', icon: Settings },
];

export function Layout() {
  const { t, data, user, logout } = useApp();
  const c = data.settings.center;
  return (
    <div className="min-h-dvh bg-slate-100 md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-10 w-10 rounded-xl" />
            <div>
              <div className="font-bold text-slate-900">{t('appName')}</div>
              <div className="text-xs text-slate-500">
                {c.name} · {c.number}
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <Icon size={20} />
              {t(label)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-slate-100 p-3">
          <div className="min-w-0 flex-1 px-1">
            <div className="truncate text-sm font-semibold text-slate-700">{user.name}</div>
            <div className="truncate text-xs text-slate-400">{user.login}</div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
            aria-label={t('logout')}
            title={t('logout')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900">{t('appName')}</div>
            <div className="text-xs text-slate-500">
              {c.name} · {c.number}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-3 pt-4 pb-28 md:px-8 md:pt-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center gap-0.5 py-2 text-center text-[11px] leading-tight font-semibold ${isActive ? 'text-teal-700' : 'text-slate-500'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`rounded-full px-3 py-1 ${isActive ? 'bg-teal-50' : ''}`}>
                  <Icon size={22} />
                </span>
                {t(label)}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
