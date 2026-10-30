import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Copy, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react';
import { reportError } from '../api/http';
import { POSHAN_LOGIN_URL, POSHAN_SUBMIT_URL, portalLoginApi, type PortalLoginState } from '../api/portalLogin';
import { useApp } from '../state/AppDataContext';
import { Button, ButtonLink, Card, Flash, useFlash } from './ui';

function CopyRow({ label, display, onCopy, extra }: { label: string; display: string; onCopy: () => void; extra?: ReactNode }) {
  const { t } = useApp();
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-slate-700">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-slate-50 px-3 py-2.5 text-base text-slate-900 ring-1 ring-slate-200" aria-label={label}>
          {display}
        </code>
        {extra}
        <Button onClick={onCopy} aria-label={`${t('copy')} ${label}`}>
          <Copy size={16} /> {t('copy')}
        </Button>
      </div>
    </div>
  );
}

/** Saved Poshan portal login with copy buttons, and links that open the portal in a new tab. */
export function PortalShortcutCard() {
  const { t } = useApp();
  const [state, setState] = useState<PortalLoginState | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [flash, setFlash] = useFlash();

  useEffect(() => {
    portalLoginApi.get().then(setState, (e) => {
      reportError(e);
      setState({ available: false, login: null });
    });
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFlash(t('copied'));
    } catch (e) {
      reportError(e);
    }
  }

  const login = state?.login;
  return (
    <Card title={t('poshanPortal')} hint={login ? t('portalSteps') : undefined}>
      {state === null ? (
        <Loader2 size={18} className="animate-spin text-slate-400" />
      ) : login ? (
        <div className="space-y-3">
          <CopyRow label={t('portalUsername')} display={login.username} onCopy={() => void copy(login.username)} />
          <CopyRow
            label={t('portalPassword')}
            display={showPassword ? login.password : '•'.repeat(Math.min(login.password.length, 12))}
            onCopy={() => void copy(login.password)}
            extra={
              <Button
                variant="ghost"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                title={showPassword ? t('hidePassword') : t('showPassword')}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          {t('noPortalLogin')}
          <Link to="/settings">
            <Button>{t('addPortalLogin')}</Button>
          </Link>
        </div>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ButtonLink variant="primary" href={POSHAN_SUBMIT_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} /> {t('openJanAndolanForm')}
        </ButtonLink>
        <ButtonLink href={POSHAN_LOGIN_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} /> {t('openPortalLogin')}
        </ButtonLink>
      </div>
      <Flash message={flash} />
    </Card>
  );
}
