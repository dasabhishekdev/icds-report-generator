import { useEffect, useState } from 'react';
import type { User } from '../api/auth';
import type { Language } from '../db/schema';
import { rememberLanguage, storedLanguage } from '../i18n/lang';
import { inAndroidApp } from '../lib/androidApp';
import { AuthPage } from './AuthPage';
import { LandingPage } from './LandingPage';

const wantsLogin = () => inAndroidApp() || window.location.hash.startsWith('#/login');

/** Signed-out view: the public home page on the website (#/login opens the form); the Android app goes straight to login. */
export function PublicSite({ onAuthenticated }: { onAuthenticated: (user: User) => Promise<void> }) {
  const [lang, setLang] = useState<Language>(storedLanguage);
  const [login, setLogin] = useState(wantsLogin);
  useEffect(() => {
    const sync = () => setLogin(wantsLogin());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const changeLanguage = (next: Language) => {
    setLang(next);
    rememberLanguage(next);
  };

  if (login) {
    return (
      <AuthPage
        onAuthenticated={onAuthenticated}
        lang={lang}
        onLanguage={changeLanguage}
        onHome={inAndroidApp() ? undefined : () => (window.location.hash = '#/')}
      />
    );
  }
  return <LandingPage lang={lang} onLanguage={changeLanguage} onLogin={() => (window.location.hash = '#/login')} />;
}
