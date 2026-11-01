import { useState, type FormEvent } from 'react';
import { ArrowLeft, LogIn, UserPlus } from 'lucide-react';
import { authApi, type User } from '../api/auth';
import { ApiError } from '../api/http';
import type { CenterInfo, Language } from '../db/schema';
import type { StringKey } from '../i18n/strings';
import { rememberLanguage, translator } from '../i18n/lang';
import { Button, Field, Segmented, TextInput } from '../components/ui';

type Mode = 'login' | 'register';

const CENTRE_FIELDS: { key: keyof CenterInfo; label: StringKey; required?: boolean }[] = [
  { key: 'name', label: 'centreName', required: true },
  { key: 'number', label: 'centreNumber', required: true },
  { key: 'code', label: 'centreCode' },
  { key: 'gramPanchayat', label: 'gramPanchayat' },
  { key: 'project', label: 'project' },
  { key: 'district', label: 'district' },
];

/** Login and registration; on the website `onHome` leads back to the public page, in the Android app there is none. */
export function AuthPage({
  onAuthenticated,
  lang,
  onLanguage,
  onHome,
}: {
  onAuthenticated: (user: User) => Promise<void>;
  lang: Language;
  onLanguage: (lang: Language) => void;
  onHome?: () => void;
}) {
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
    <div className="flex min-h-dvh items-start justify-center bg-gradient-to-b from-teal-700 to-teal-900 px-4 py-8 sm:py-10 md:items-center">
      <div className="w-full max-w-md">
        <header className="mb-6 flex items-center justify-between gap-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icon.svg" alt="" className="h-12 w-12 shrink-0 rounded-2xl shadow" />
            <div className="min-w-0">
              <div className="text-xl font-bold">{t('appName')}</div>
              <div className="text-sm text-teal-100">{t('authTagline')}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onLanguage(lang === 'bn' ? 'en' : 'bn')}
            className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
          >
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </header>

      <form
        onSubmit={(e) => void submit(e)}
        className="space-y-4 rounded-3xl bg-white p-5 shadow-xl"
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

        {onHome && (
          <button type="button" onClick={onHome} className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-teal-100 hover:text-white">
            <ArrowLeft size={16} /> {t('backToHome')}
          </button>
        )}
      </div>
    </div>
  );
}
