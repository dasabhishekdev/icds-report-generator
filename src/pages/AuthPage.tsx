import { useState, type FormEvent } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { authApi, type User } from '../api/auth';
import { ApiError } from '../api/http';
import type { CenterInfo, Language } from '../db/schema';
import type { StringKey } from '../i18n/strings';
import { rememberLanguage, storedLanguage, translator } from '../i18n/lang';
import { Button, Field, Segmented, TextInput } from '../components/ui';
import { ShowcaseGallery, ShowcaseIntro } from './Showcase';

type Mode = 'login' | 'register';

const CENTRE_FIELDS: { key: keyof CenterInfo; label: StringKey; required?: boolean }[] = [
  { key: 'name', label: 'centreName', required: true },
  { key: 'number', label: 'centreNumber', required: true },
  { key: 'code', label: 'centreCode' },
  { key: 'gramPanchayat', label: 'gramPanchayat' },
  { key: 'project', label: 'project' },
  { key: 'district', label: 'district' },
];

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: User) => Promise<void> }) {
  const [lang, setLang] = useState<Language>(storedLanguage);
  const t = translator(lang);
  const [mode, setMode] = useState<Mode>('login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [name, setName] = useState('');
  const [center, setCenter] = useState<Partial<CenterInfo>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } =
        mode === 'login'
          ? await authApi.login(login, password, remember)
          : await authApi.register({ login, password, name, center: { ...center, workerName: name }, language: lang });
      rememberLanguage(lang);
      await onAuthenticated(user);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const known: Record<number, StringKey> = { 401: 'wrongLogin', 409: 'loginExists', 429: 'tooManyAttempts' };
      setError(known[status] ? t(known[status]) : err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-teal-700 to-teal-900 px-4 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-12 w-12 rounded-2xl shadow" />
            <div>
              <div className="text-xl font-bold">{t('appName')}</div>
              <div className="text-sm text-teal-100">{t('authTagline')}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
          >
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </header>

        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-start">
          <div className="order-2 md:order-1">
            <ShowcaseIntro t={t} />
          </div>
          <form
            onSubmit={(e) => void submit(e)}
            className="order-1 space-y-4 rounded-3xl bg-white p-5 shadow-xl md:sticky md:top-6 md:order-2"
          >
            <Segmented
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              options={[
                { value: 'login', label: t('login') },
                { value: 'register', label: t('register') },
              ]}
            />

            {mode === 'register' && (
              <Field label={`${t('yourName')} *`}>
                <TextInput value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </Field>
            )}
            <Field label={`${t('loginId')} *`}>
              <TextInput
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
              />
            </Field>
            <Field label={`${t('password')} *`} hint={mode === 'register' ? t('passwordHint') : undefined}>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 8 : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </Field>

            {mode === 'login' && (
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-teal-700"
                />
                <span className="text-sm">
                  <span className="block font-semibold text-slate-800">{t('rememberMe')}</span>
                  <span className="block text-xs text-slate-500">{t('rememberMeHint')}</span>
                </span>
              </label>
            )}

            {mode === 'register' && (
              <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
                <div className="text-sm font-bold text-slate-700">{t('centreInfo')}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CENTRE_FIELDS.map(({ key, label, required }) => (
                    <Field key={key} label={`${t(label)}${required ? ' *' : ''}`}>
                      <TextInput
                        value={center[key] ?? ''}
                        required={required}
                        onChange={(e) => setCenter({ ...center, [key]: e.target.value })}
                      />
                    </Field>
                  ))}
                </div>
                <p className="text-xs text-slate-500">{t('registerHint')}</p>
              </div>
            )}

            {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">{error}</div>}

            <Button type="submit" variant="primary" className="w-full py-3 text-base" disabled={busy}>
              {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
              {busy ? t('preparing') : mode === 'login' ? t('login') : t('createAccount')}
            </Button>
          </form>
        </div>

        <div className="mt-8">
          <ShowcaseGallery t={t} />
        </div>
      </div>
    </div>
  );
}
