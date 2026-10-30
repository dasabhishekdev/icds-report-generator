import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import { reportError } from '../api/http';
import { portalLoginApi, type PortalLoginState } from '../api/portalLogin';
import { useApp } from '../state/AppDataContext';
import { Button, Card, Field, TextInput } from './ui';

/** Settings card where the worker stores their Poshan Abhiyaan portal login. */
export function PortalLoginCard({ onDone }: { onDone: (msg: string) => void }) {
  const { t } = useApp();
  const [state, setState] = useState<PortalLoginState | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const next = await portalLoginApi.get();
      setState(next);
      setUsername(next.login?.username ?? '');
      setPassword(next.login?.password ?? '');
    } catch (e) {
      reportError(e);
      setState({ available: false, login: null });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    try {
      await action();
      await load();
      onDone(message);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <Card title={t('portalLogin')}>
        <Loader2 size={18} className="animate-spin text-slate-400" />
      </Card>
    );
  }
  if (!state.available) {
    return (
      <Card title={t('portalLogin')}>
        <p className="text-sm text-slate-600">{t('portalLoginUnavailable')}</p>
      </Card>
    );
  }

  const unchanged = username.trim() === (state.login?.username ?? '') && password === (state.login?.password ?? '');
  return (
    <Card title={t('portalLogin')} hint={t('hintPortalLogin')}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => portalLoginApi.save({ username: username.trim(), password }), t('saved'));
        }}
      >
        <Field label={t('portalUsername')}>
          <TextInput value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={100} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label={t('portalPassword')}>
          <div className="flex items-center gap-2">
            <TextInput
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={100}
              autoComplete="new-password"
            />
            <Button
              variant="ghost"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              title={showPassword ? t('hidePassword') : t('showPassword')}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </Button>
          </div>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={busy || unchanged || !username.trim() || !password}>
            {t('save')}
          </Button>
          {state.login && (
            <Button variant="ghost" className="text-red-600" disabled={busy} onClick={() => void run(() => portalLoginApi.remove(), t('done'))}>
              <Trash2 size={16} /> {t('delete')}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
