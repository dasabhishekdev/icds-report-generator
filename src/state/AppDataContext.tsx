import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, type User } from '../api/auth';
import { dataStore, loadData, useAppDataStore } from '../api/data';
import { ERROR_EVENT, UNAUTHORIZED_EVENT } from '../api/http';
import type { Language } from '../db/schema';
import type { AppData } from '../domain/month';
import { localizeLabel } from '../i18n/labels';
import { rememberLanguage, storedLanguage, translator } from '../i18n/lang';
import type { StringKey } from '../i18n/strings';
import { PublicSite } from '../pages/PublicSite';

interface AppState {
  data: AppData;
  lang: Language;
  t: (key: StringKey) => string;
  /** Shows a data-entered name (category, fuel item, holiday) in the app language. */
  label: (text: string) => string;
  user: User;
  logout: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

type Auth = { status: 'loading' } | { status: 'anonymous' } | { status: 'ready'; user: User };

function Spinner() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
    </div>
  );
}

function ErrorBanner() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const onError = (e: Event) => setMessage((e as CustomEvent<string>).detail);
    window.addEventListener(ERROR_EVENT, onError);
    return () => window.removeEventListener(ERROR_EVENT, onError);
  }, []);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(id);
  }, [message]);
  if (!message) return null;
  return (
    <div className="fixed inset-x-0 top-3 z-[60] flex justify-center px-3" role="alert">
      <div className="max-w-md rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-lg">⚠ {message}</div>
    </div>
  );
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<Auth>({ status: 'loading' });
  const data = useAppDataStore();

  const enter = useCallback(async (user: User) => {
    dataStore.set(await loadData());
    setAuth({ status: 'ready', user });
  }, []);

  useEffect(() => {
    authApi
      .me()
      .then(({ user }) => (user ? enter(user) : setAuth({ status: 'anonymous' })))
      .catch(() => setAuth({ status: 'anonymous' }));
    const onUnauthorized = () => {
      dataStore.set(null);
      setAuth({ status: 'anonymous' });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [enter]);

  const lang = data?.settings.language ?? storedLanguage();
  useEffect(() => {
    rememberLanguage(lang);
  }, [lang]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    dataStore.set(null);
    setAuth({ status: 'anonymous' });
  }, []);

  let content: ReactNode;
  if (auth.status === 'loading' || (auth.status === 'ready' && !data)) content = <Spinner />;
  else if (auth.status === 'anonymous') content = <PublicSite onAuthenticated={enter} />;
  else content = <Ctx.Provider value={{ data: data!, lang, t: translator(lang), label: (text) => localizeLabel(text, lang), user: auth.user, logout }}>{children}</Ctx.Provider>;

  return (
    <>
      <ErrorBanner />
      {content}
    </>
  );
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppDataProvider');
  return ctx;
}
