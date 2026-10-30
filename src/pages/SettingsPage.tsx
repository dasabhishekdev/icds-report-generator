import { useRef, useState } from 'react';
import { ChevronRight, Database, Download, KeyRound, LogOut, Plus, Trash2, Upload, UserRound } from 'lucide-react';
import { authApi } from '../api/auth';
import { dataApi, exportBackup, newId } from '../api/data';
import { emptyNorms } from '../db/defaults';
import { sampleData } from '../db/sampleData';
import type { BackupFile, Category, CenterInfo, FuelItem, Language, Settings } from '../db/schema';
import { WEEKDAYS_BN, WEEKDAYS_EN, todayIso } from '../domain/dates';
import { downloadJson } from '../lib/download';
import type { StringKey } from '../i18n/strings';
import { useApp } from '../state/AppDataContext';
import { Button, Card, Field, Flash, Modal, NumberInput, Segmented, TextInput, useFlash } from '../components/ui';
import { CategoryEditor } from './CategoryEditor';

const saveSettings = (patch: Partial<Omit<Settings, 'id'>>) => dataApi.saveSettings(patch);

export function SettingsPage() {
  const { t, data } = useApp();
  const [flash, setFlash] = useFlash();
  const saved = (ok: boolean) => ok && setFlash(t('saved'));
  const { center, rates, fuelItems, language, nursingMonths, weeklyOffDays } = data.settings;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">{t('navSettings')}</h1>
      <AccountCard onDone={(msg) => setFlash(msg)} />
      <GeneralCard key={`${language}-${nursingMonths}`} onSaved={saved} />
      <CentreCard key={JSON.stringify(center)} onSaved={saved} />
      <RatesCard key={JSON.stringify(rates)} onSaved={saved} />
      <CategoriesCard />
      <HolidaysCard key={weeklyOffDays.join()} onSaved={saved} />
      <FuelItemsCard key={JSON.stringify(fuelItems)} onSaved={saved} />
      <DataCard onDone={() => setFlash(t('done'))} />
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
    <Card title={t('account')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <UserRound size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900">{user.name}</div>
          <div className="truncate text-sm text-slate-500">{user.login}</div>
        </div>
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

function GeneralCard({ onSaved }: { onSaved: (ok: boolean) => void }) {
  const { t, data } = useApp();
  const [language, setLanguage] = useState<Language>(data.settings.language);
  const [nursingMonths, setNursingMonths] = useState<number | undefined>(data.settings.nursingMonths);
  const valid = nursingMonths !== undefined && Number.isInteger(nursingMonths) && nursingMonths > 0;
  return (
    <Card title={t('general')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void saveSettings({ language, nursingMonths }).then(onSaved);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('language')}>
            <Segmented
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'bn', label: 'বাংলা' },
                { value: 'en', label: 'English' },
              ]}
            />
          </Field>
          <Field label={t('nursingMonths')}>
            <NumberInput value={nursingMonths} step="1" onChange={setNursingMonths} />
          </Field>
        </div>
        <Button type="submit" variant="primary" className="mt-4" disabled={!valid}>
          {t('save')}
        </Button>
      </form>
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
    <Card title={t('centreInfo')}>
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

function RatesCard({ onSaved }: { onSaved: (ok: boolean) => void }) {
  const { t, data } = useApp();
  const [rates, setRates] = useState(data.settings.rates);
  const fields: { key: keyof Settings['rates']; label: StringKey }[] = [
    { key: 'egg', label: 'eggRate' },
    { key: 'veg', label: 'vegRate' },
    { key: 'potato', label: 'potatoRate' },
    { key: 'chatu', label: 'chatuRate' },
  ];
  return (
    <Card title={t('rates')}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map(({ key, label }) => (
          <Field key={key} label={t(label)}>
            <NumberInput value={rates[key]} onChange={(v) => setRates({ ...rates, [key]: v ?? 0 })} />
          </Field>
        ))}
      </div>
      <Button variant="primary" className="mt-4" onClick={() => void saveSettings({ rates }).then(onSaved)}>
        {t('save')}
      </Button>
    </Card>
  );
}

function CategoriesCard() {
  const { t, data } = useApp();
  const [editing, setEditing] = useState<{ category: Category; isNew: boolean } | null>(null);
  const range = (c: Category) =>
    c.group === 'mother'
      ? t(c.motherStage === 'nursing' ? 'nursing' : 'pregnant')
      : `${c.minMonths ?? 0}–${c.maxMonths ?? '∞'} ${t('month')}`;

  const addNew = () => {
    const maxOrder = Math.max(0, ...data.categories.map((c) => c.sortOrder));
    setEditing({
      isNew: true,
      category: { id: newId(), name: '', group: 'child', minMonths: 0, maxMonths: 12, servesMeal: true, sortOrder: maxOrder + 1, norms: emptyNorms() },
    });
  };

  return (
    <Card
      title={t('categoriesNorms')}
      actions={
        <Button onClick={addNew}>
          <Plus size={16} /> {t('addCategory')}
        </Button>
      }
    >
      <ul className="divide-y divide-slate-100">
        {data.categories.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => setEditing({ category: c, isNew: false })} className="flex w-full items-center gap-3 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{c.name}</span>
                <span className="block text-xs text-slate-500">
                  {range(c)}
                  {c.servesMeal
                    ? ` · ${t('khichuri')}: ${t('itemRice')} ${c.norms.khichuri.rice}g, ${t('itemEgg')} ${c.norms.khichuri.egg} · ${t('rice')}: ${t('itemRice')} ${c.norms.rice.rice}g, ${t('itemEgg')} ${c.norms.rice.egg}`
                    : ` · ${t('notServed')}`}
                </span>
              </span>
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          </li>
        ))}
      </ul>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.isNew ? t('addCategory') : t('edit')}>
        {editing && <CategoryEditor key={editing.category.id} category={editing.category} isNew={editing.isNew} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

function HolidaysCard({ onSaved }: { onSaved: (ok: boolean) => void }) {
  const { t, data, lang } = useApp();
  const { holidays } = data.settings;
  const [weeklyOff, setWeeklyOff] = useState<number[]>(data.settings.weeklyOffDays);
  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState('');
  const names = lang === 'bn' ? WEEKDAYS_BN : WEEKDAYS_EN;
  const sorted = [...holidays].sort((a, b) => (a.date < b.date ? -1 : 1));
  const weeklyDirty = [...weeklyOff].sort().join() !== [...data.settings.weeklyOffDays].sort().join();

  const toggleDay = (d: number) => setWeeklyOff((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const add = async () => {
    if (!date || !name.trim()) return;
    const ok = await saveSettings({ holidays: [...holidays.filter((h) => h.date !== date), { date, name: name.trim() }] });
    if (ok) setName('');
    onSaved(ok);
  };

  return (
    <Card title={t('holidaysTitle')}>
      <form
        className="mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          void saveSettings({ weeklyOffDays: [...weeklyOff].sort() }).then(onSaved);
        }}
      >
        <div className="mb-2 text-sm font-medium text-slate-700">{t('weeklyOff')}</div>
        <div className="flex flex-wrap items-center gap-2">
          {names.map((n, d) => (
            <button
              key={n}
              type="button"
              aria-pressed={weeklyOff.includes(d)}
              onClick={() => toggleDay(d)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${weeklyOff.includes(d) ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {n}
            </button>
          ))}
          <Button type="submit" variant="primary" disabled={!weeklyDirty} className="ml-auto">
            {t('save')}
          </Button>
        </div>
      </form>
      {sorted.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-100">
          {sorted.map((h) => (
            <li key={h.date} className="flex items-center gap-3 py-2">
              <span className="w-28 text-sm text-slate-500">{h.date}</span>
              <span className="flex-1 font-medium text-slate-800">{h.name}</span>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label={t('delete')}
                onClick={() => {
                  if (confirm(t('confirmDelete'))) void saveSettings({ holidays: holidays.filter((x) => x.date !== h.date) });
                }}
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-2 sm:grid-cols-[auto_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <TextInput placeholder={t('holidayName')} value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          <Plus size={16} /> {t('addHoliday')}
        </Button>
      </form>
    </Card>
  );
}

function FuelItemsCard({ onSaved }: { onSaved: (ok: boolean) => void }) {
  const { t, data } = useApp();
  const [items, setItems] = useState<FuelItem[]>(data.settings.fuelItems);
  const update = (id: string, patch: Partial<FuelItem>) => setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  return (
    <Card
      title={t('fuelItems')}
      actions={
        <Button onClick={() => setItems([...items, { id: newId(), name: '', unit: 'Kg', rate: 0, qtyPerBeneficiaryDay: 0 }])}>
          <Plus size={16} /> {t('addItem')}
        </Button>
      }
    >
      <p className="mb-3 text-xs text-slate-500">{t('fuelHint')}</p>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl bg-slate-50 p-3">
            <div className="flex gap-2">
              <TextInput value={item.name} placeholder={t('name')} onChange={(e) => update(item.id, { name: e.target.value })} />
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label={t('delete')}
                onClick={() => setItems(items.filter((i) => i.id !== item.id))}
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Field label={t('unit')}>
                <TextInput value={item.unit} onChange={(e) => update(item.id, { unit: e.target.value })} />
              </Field>
              <Field label={t('rate')}>
                <NumberInput value={item.rate} onChange={(v) => update(item.id, { rate: v ?? 0 })} />
              </Field>
              <Field label={t('perBenDay')}>
                <NumberInput value={item.qtyPerBeneficiaryDay} onChange={(v) => update(item.id, { qtyPerBeneficiaryDay: v ?? 0 })} />
              </Field>
            </div>
          </div>
        ))}
      </div>
      <Button variant="primary" className="mt-4" onClick={() => void saveSettings({ fuelItems: items.filter((i) => i.name.trim()) }).then(onSaved)}>
        {t('save')}
      </Button>
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

  /** Sample attendance and stock, but the account keeps its own centre details. */
  const loadSample = () =>
    confirm(t('sampleConfirm')) &&
    run(() => {
      const s = sampleData();
      return dataApi.importBackup(exportBackup({ ...s, settings: { ...s.settings, center: data.settings.center, language: data.settings.language } }));
    });

  const eraseAll = () => confirm(t('resetConfirm')) && run(() => dataApi.resetAll());

  return (
    <Card title={t('data')}>
      <p className="mb-3 text-sm text-slate-600">{t('dataHint')}</p>
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
        <Button disabled={busy} onClick={() => void loadSample()}>
          <Database size={18} /> {t('loadSample')}
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => void eraseAll()}>
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
