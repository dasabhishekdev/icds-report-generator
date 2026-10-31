import { useRef, useState } from 'react';
import { Download, KeyRound, LogOut, Mail, Trash2, Upload, UserRound } from 'lucide-react';
import { authApi } from '../../api/auth';
import { dataApi, exportBackup } from '../../api/data';
import type { BackupFile, CenterInfo, Language, Settings } from '../../db/schema';
import { todayIso } from '../../domain/dates';
import { downloadJson } from '../../lib/download';
import type { StringKey } from '../../i18n/strings';
import { useApp } from '../../state/AppDataContext';
import { Button, ButtonLink, Card, Field, Flash, Modal, Segmented, TextInput, useFlash } from '../../components/ui';
import { PortalLoginCard } from '../../components/PortalLoginCard';
import { SettingsHeader } from './SettingsHeader';

const saveSettings = (patch: Partial<Omit<Settings, 'id'>>) => dataApi.saveSettings(patch);

/** The worker's own things: login, Poshan portal login, centre details, language, backup. */
export function AccountSettingsPage() {
  const { t, data } = useApp();
  const [flash, setFlash] = useFlash();
  const saved = (ok: boolean) => ok && setFlash(t('saved'));
  return (
    <div className="space-y-4">
      <SettingsHeader />
      <AccountCard onDone={(msg) => setFlash(msg)} />
      <PortalLoginCard onDone={(msg) => setFlash(msg)} />
      <CentreCard key={JSON.stringify(data.settings.center)} onSaved={saved} />
      <LanguageCard />
      <DataCard onDone={() => setFlash(t('done'))} />
      <ContactCard />
      <Flash message={flash} />
    </div>
  );
}

function AccountCard({ onDone }: { onDone: (msg: string) => void }) {
  const { t, user, logout } = useApp();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function change() {
    setError(null);
    try {
      await authApi.changePassword(current, next);
      setOpen(false);
      setCurrent('');
      setNext('');
      onDone(t('passwordChanged'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card title={t('account')} hint={t('hintAccount')}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <UserRound size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900">{user.name}</div>
          <div className="truncate text-sm text-slate-500">{user.login}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => setOpen(true)}>
          <KeyRound size={16} /> {t('changePassword')}
        </Button>
        <Button variant="danger" onClick={() => void logout()}>
          <LogOut size={16} /> {t('logout')}
        </Button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t('changePassword')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void change();
          }}
        >
          <Field label={t('currentPassword')}>
            <TextInput type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </Field>
          <Field label={t('newPassword')} hint={t('passwordHint')}>
            <TextInput type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
          </Field>
          {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className="flex-1">
              {t('save')}
            </Button>
            <Button onClick={() => setOpen(false)}>{t('cancel')}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

const CENTRE_FIELDS: { key: keyof CenterInfo; label: StringKey }[] = [
  { key: 'name', label: 'centreName' },
  { key: 'number', label: 'centreNumber' },
  { key: 'code', label: 'centreCode' },
  { key: 'gramPanchayat', label: 'gramPanchayat' },
  { key: 'project', label: 'project' },
  { key: 'district', label: 'district' },
  { key: 'workerName', label: 'workerName' },
  { key: 'vegShopkeeper', label: 'vegShopkeeper' },
  { key: 'fuelShopkeeper', label: 'fuelShopkeeper' },
];

function CentreCard({ onSaved }: { onSaved: (ok: boolean) => void }) {
  const { t, data } = useApp();
  const [center, setCenter] = useState(data.settings.center);
  return (
    <Card title={t('centreInfo')} hint={t('hintCentre')}>
      <div className="grid gap-3 sm:grid-cols-2">
        {CENTRE_FIELDS.map(({ key, label }) => (
          <Field key={key} label={t(label)}>
            <TextInput value={center[key]} onChange={(e) => setCenter({ ...center, [key]: e.target.value })} />
          </Field>
        ))}
      </div>
      <Button variant="primary" className="mt-4" disabled={!center.name.trim() || !center.number.trim()} onClick={() => void saveSettings({ center }).then(onSaved)}>
        {t('save')}
      </Button>
    </Card>
  );
}

function LanguageCard() {
  const { t, data } = useApp();
  const setLanguage = (language: Language) => {
    if (language !== data.settings.language) void saveSettings({ language });
  };
  return (
    <Card title={t('language')} hint={t('hintLanguage')}>
      <Segmented
        value={data.settings.language}
        onChange={setLanguage}
        options={[
          { value: 'bn', label: 'বাংলা' },
          { value: 'en', label: 'English' },
        ]}
      />
    </Card>
  );
}

function DataCard({ onDone }: { onDone: () => void }) {
  const { t, data } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const restore = (file: File) =>
    confirm(t('importConfirm')) &&
    run(async () => dataApi.importBackup(JSON.parse(await file.text()) as BackupFile));

  const eraseAll = () => confirm(t('resetConfirm')) && run(() => dataApi.resetAll());

  return (
    <Card title={t('data')} hint={t('dataHint')}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="primary"
          onClick={() => downloadJson(exportBackup(data), `ICDS_${data.settings.center.number || 'centre'}_backup_${todayIso()}.json`)}
        >
          <Download size={18} /> {t('exportBackup')}
        </Button>
        <Button disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload size={18} /> {t('importBackup')}
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => void eraseAll()} className="sm:col-span-2">
          <Trash2 size={18} /> {t('resetAll')}
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void restore(f);
          e.target.value = '';
        }}
      />
    </Card>
  );
}

const DEVELOPER_EMAIL = 'abhishekdasdev@outlook.com';

function ContactCard() {
  const { t, data, user } = useApp();
  const { center } = data.settings;
  const subject = `ICDS Reports — AWC ${center.number || '?'} ${center.name}`.trim();
  const body = `\n\n—\n${user.name} (${user.login})\nAWC ${center.number} ${center.name}`;
  const href = `mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <Card title={t('contactDeveloper')} hint={t('contactHint')}>
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink variant="primary" href={href}>
          <Mail size={18} /> {t('emailDeveloper')}
        </ButtonLink>
        <a href={`mailto:${DEVELOPER_EMAIL}`} className="text-sm font-medium break-all text-teal-700 underline">
          {DEVELOPER_EMAIL}
        </a>
      </div>
    </Card>
  );
}
