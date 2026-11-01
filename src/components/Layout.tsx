import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { CalendarDays, Camera, ClipboardCheck, FileSpreadsheet, LogOut, Settings, UserRound, Users } from 'lucide-react';
import { useApp } from '../state/AppDataContext';
import type { StringKey } from '../i18n/strings';
import { AppUpdateBanner } from './AppUpdateBanner';
import { LocationAccess } from './LocationAccess';

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
  const { pathname } = useLocation();
  const scroller = useRef<HTMLDivElement>(null);
  // A new tab opens at its top, not at the previous tab's scroll position.
  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [pathname]);
  // App shell: the window never scrolls, only the content pane does, so the header and the
  // bottom nav stay put (no jumping with the iOS toolbar or overscroll bounce) and short pages
  // still fill the screen.
  return (
    <div className="flex h-dvh overflow-hidden bg-slate-100">
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
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
          <Link to="/settings/account" className="min-w-0 flex-1 rounded-lg px-1 py-0.5 hover:bg-slate-50" title={t('accountSettings')}>
            <div className="truncate text-sm font-semibold text-slate-700">{user.name}</div>
            <div className="truncate text-xs text-slate-400">{user.login}</div>
          </Link>
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 md:hidden">
          <img src="/icon.svg" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-sm font-bold text-slate-900">{t('appName')}</div>
            <div className="truncate text-xs text-slate-500">
              {c.name} · {c.number}
            </div>
          </div>
          <Link
            to="/settings/account"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 active:bg-teal-100"
            aria-label={t('accountSettings')}
            title={t('accountSettings')}
          >
            <UserRound size={20} />
          </Link>
        </header>
        <div ref={scroller} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <main className="mx-auto min-h-full max-w-5xl px-2.5 pt-3 pb-6 min-[390px]:px-3 md:px-8 md:pt-8 md:pb-10">
            <AppUpdateBanner t={t} />
            <LocationAccess variant="global" />
            <Outlet />
          </main>
        </div>

        <nav className="z-40 grid shrink-0 grid-cols-6 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-w-0 flex-col items-center gap-0.5 px-0.5 pt-1.5 pb-1 text-center text-[10px] leading-tight font-semibold min-[431px]:text-[11px] ${isActive ? 'text-teal-700' : 'text-slate-500'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`rounded-full px-3 py-1 ${isActive ? 'bg-teal-50' : ''}`}>
                    <Icon size={20} />
                  </span>
                  <span className="w-full truncate">{t(label)}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
