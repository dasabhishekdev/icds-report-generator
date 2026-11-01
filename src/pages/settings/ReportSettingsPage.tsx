import { useState } from 'react';
import { CalendarCheck, CalendarX, ChevronLeft, ChevronRight, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { dataApi, newId } from '../../api/data';
import { emptyNorms } from '../../db/defaults';
import {
  MEAL_TYPES,
  PURCHASED_ITEM_KEYS,
  STATE_HOLIDAY_MODES,
  STOCK_ITEM_KEYS,
  type Category,
  type CategoryGroup,
  type MealType,
  type Settings,
  type StateHolidayMode,
  type WeighedItemKey,
  WEIGHED_ITEM_KEYS,
} from '../../db/schema';
import { itemCost, rateGramsFor } from '../../domain/calc';
import { WEEKDAYS_BN, WEEKDAYS_EN, formatMonths, prettyDate, todayIso } from '../../domain/dates';
import { stateHolidayMode, type HolidaySource } from '../../domain/holidays';
import type { StringKey } from '../../i18n/strings';
import { ITEM_LABEL, MEAL_LABEL, formatQty, rupees } from '../../lib/format';
import { useApp } from '../../state/AppDataContext';
import { Button, Card, Field, Flash, Modal, NumberInput, Segmented, TextInput, Toggle, useFlash } from '../../components/ui';
import { CategoryEditor } from '../CategoryEditor';
import { SettingsHeader } from './SettingsHeader';

const saveSettings = (patch: Partial<Omit<Settings, 'id'>>) => dataApi.saveSettings(patch);

const CATEGORY_GROUPS: { group: CategoryGroup; title: StringKey }[] = [
  { group: 'mother', title: 'mothers' },
  { group: 'child', title: 'children' },
];

/** Everything the ration calculation and the registers depend on. */
export function ReportSettingsPage() {
  const { t, data } = useApp();
  const [flash, setFlash] = useFlash();
  const saved = (ok: boolean) => ok && setFlash(t('saved'));
  const { rates, rateGrams, fuelPerCookingDay, nursingMonths, weeklyOffDays } = data.settings;
  return (
    <div className="space-y-4">
      <SettingsHeader />
      <ItemsCard key={JSON.stringify([rates, rateGrams, fuelPerCookingDay])} onSaved={saved} />
      <CategoriesCard />
      <NursingPeriodCard key={nursingMonths} onSaved={saved} />
      <HolidaysCard key={weeklyOffDays.join()} onSaved={saved} />
      <SnpMoneyCard />
      <DefaultsCard onDone={() => setFlash(t('done'))} />
      <Flash message={flash} />
    </div>
  );
}

function DefaultsCard({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);

  async function loadDefaults() {
    if (!confirm(t('defaultsConfirm'))) return;
    setBusy(true);
    try {
      await dataApi.loadDefaults();
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t('defaultsTitle')} hint={t('defaultsHint')}>
      <Button disabled={busy} onClick={() => void loadDefaults()}>
        <RotateCcw size={18} /> {t('loadDefaults')}
      </Button>
    </Card>
  );
}

function NursingPeriodCard({ onSaved }: { onSaved: (ok: boolean) => void }) {
  const { t, data } = useApp();
  const [nursingMonths, setNursingMonths] = useState<number | undefined>(data.settings.nursingMonths);
  const valid = nursingMonths !== undefined && Number.isInteger(nursingMonths) && nursingMonths > 0;
  const dirty = nursingMonths !== data.settings.nursingMonths;
  return (
    <Card title={t('nursingMonths')} hint={t('nursingHint')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void saveSettings({ nursingMonths }).then(onSaved);
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Field label={t('months')}>
              <NumberInput value={nursingMonths} step="1" onChange={setNursingMonths} />
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={!valid || !dirty}>
            {t('save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Every item the registers use, in fixed groups: bought (priced), government supplied (no rate), fuel per day. */
function ItemsCard({ onSaved }: { onSaved: (ok: boolean) => void }) {
  const { t, data } = useApp();
  const [rates, setRates] = useState(data.settings.rates);
  const [perDay, setPerDay] = useState(data.settings.fuelPerCookingDay ?? 0);
  const [grams, setGrams] = useState<Record<WeighedItemKey, number | undefined>>(
    () => Object.fromEntries(WEIGHED_ITEM_KEYS.map((item) => [item, rateGramsFor(data.settings, item)])) as Record<WeighedItemKey, number>,
  );
  const valid = WEIGHED_ITEM_KEYS.every((item) => (grams[item] ?? 0) > 0);
  const save = () => {
    const rateGrams = Object.fromEntries(WEIGHED_ITEM_KEYS.map((item) => [item, grams[item]!])) as Record<WeighedItemKey, number>;
    void saveSettings({ rates, rateGrams, fuelPerCookingDay: perDay }).then(onSaved);
  };
  return (
    <Card title={t('itemsTitle')} hint={t('itemsHint')}>
      <h3 className="mb-1 text-xs font-bold tracking-wide text-slate-500 uppercase">{t('boughtItems')}</h3>
      <p className="mb-3 text-xs text-slate-500">{t('hintRates')}</p>
      <div className="space-y-3">
        <div className="grid grid-cols-[6rem_1fr_auto_1fr] items-center gap-2">
          <span className="font-medium text-slate-700">{t('itemEgg')}</span>
          <span className="text-sm text-slate-600">1 {t('pcs')}</span>
          <span className="text-slate-500">= ₹</span>
          <NumberInput value={rates.egg} onChange={(v) => setRates({ ...rates, egg: v ?? 0 })} />
        </div>
        {WEIGHED_ITEM_KEYS.map((item) => {
          const g = grams[item] ?? 0;
          return (
            <div key={item}>
              <div className="grid grid-cols-[6rem_1fr_auto_1fr] items-center gap-2">
                <span className="font-medium text-slate-700">{t(ITEM_LABEL[item])}</span>
                <div className="flex items-center gap-1">
                  <NumberInput value={grams[item]} onChange={(v) => setGrams({ ...grams, [item]: v })} />
                  <span className="text-sm text-slate-500">{t('grams')}</span>
                </div>
                <span className="text-slate-500">= ₹</span>
                <NumberInput value={rates[item]} onChange={(v) => setRates({ ...rates, [item]: v ?? 0 })} />
              </div>
              {g > 0 && g !== 1000 && (
                <p className="mt-0.5 text-right text-xs text-slate-500 tabular-nums">
                  = {rupees((rates[item] * 1000) / g)} / kg
                </p>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mt-5 mb-1 text-xs font-bold tracking-wide text-slate-500 uppercase">{t('govItems')}</h3>
      <p className="mb-2 text-xs text-slate-500">{t('govItemsHint')}</p>
      <div className="flex flex-wrap gap-2">
        {STOCK_ITEM_KEYS.map((item) => (
          <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {t(ITEM_LABEL[item])}
          </span>
        ))}
      </div>

      <h3 className="mt-5 mb-1 text-xs font-bold tracking-wide text-slate-500 uppercase">{t('fuelSpicesTitle')}</h3>
      <div className="max-w-xs">
        <Field label={t('fuelPerCookingDay')} hint={t('fuelPerCookingDayHint')}>
          <NumberInput value={perDay} onChange={(v) => setPerDay(v ?? 0)} />
        </Field>
      </div>

      <Button variant="primary" className="mt-4" disabled={!valid} onClick={save}>
        {t('save')}
      </Button>
    </Card>
  );
}

function CategoriesCard() {
  const { t, data, lang, label } = useApp();
  const [editing, setEditing] = useState<{ category: Category; isNew: boolean } | null>(null);
  const range = (c: Category) =>
    c.group === 'mother'
      ? t(c.motherStage === 'nursing' ? 'nursing' : 'pregnant')
      : `${formatMonths(c.minMonths ?? 0, lang)} – ${c.maxMonths === undefined ? '∞' : formatMonths(c.maxMonths, lang)}`;
  const sorted = [...data.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  /** Bought items per head for one meal, e.g. "Egg 1 pcs = ₹8.50 · Potato 30 g = ₹0.84". */
  const mealMoney = (c: Category, meal: MealType) =>
    PURCHASED_ITEM_KEYS.filter((item) => c.norms[meal][item] > 0)
      .map((item) => `${t(ITEM_LABEL[item])} ${formatQty(item, c.norms[meal][item], t)} = ${rupees(itemCost(item, c.norms[meal][item], data.settings))}`)
      .join(' · ');

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
      hint={t('hintCategories')}
      actions={
        <Button onClick={addNew}>
          <Plus size={16} /> {t('addCategory')}
        </Button>
      }
    >
      <div className="space-y-4">
        {CATEGORY_GROUPS.map(({ group, title }) => {
          const members = sorted.filter((c) => c.group === group);
          if (!members.length) return null;
          return (
            <section key={group}>
              <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase">{t(title)}</h3>
              <ul className="divide-y divide-slate-100">
                {members.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setEditing({ category: c, isNew: false })} className="flex w-full items-center gap-3 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900">{label(c.name)}</span>
                        <span className="block text-xs text-slate-500">
                          {range(c)}
                          {!c.servesMeal && ` · ${t('notServed')}`}
                        </span>
                        {c.servesMeal &&
                          MEAL_TYPES.map((meal) => (
                            <span key={meal} className="block text-xs text-slate-600">
                              <b>{t(MEAL_LABEL[meal])}:</b> {mealMoney(c, meal) || '—'}
                            </span>
                          ))}
                      </span>
                      <ChevronRight size={18} className="text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.isNew ? t('addCategory') : t('edit')}>
        {editing && <CategoryEditor key={editing.category.id} category={editing.category} isNew={editing.isNew} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

function HolidaysCard({ onSaved }: { onSaved: (ok: boolean) => void }) {
  const { t, data, lang, label } = useApp();
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
    <Card title={t('holidaysTitle')} hint={t('hintHolidays')}>
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
      <StateCalendarSection />
      <div className="mt-5 mb-2 text-sm font-medium text-slate-700">{t('ownHolidays')}</div>
      {sorted.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-100">
          {sorted.map((h) => (
            <li key={h.date} className="flex items-center gap-3 py-2">
              <span className="w-28 text-sm text-slate-500">{h.date}</span>
              <span className="flex-1 font-medium text-slate-800">{label(h.name)}</span>
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

const SOURCE_LABEL: Record<HolidaySource, StringKey> = {
  'wb-ics': 'sourceWbIcs',
  'india-calendar-api': 'sourceIndiaApi',
  'built-in': 'sourceBuiltIn',
  none: 'sourceNone',
};

const MODE_LABEL: Record<StateHolidayMode, StringKey> = {
  all: 'stateModeAll',
  public: 'stateModePublic',
  off: 'stateModeOff',
};

function StateCalendarSection() {
  const { t, data, lang, label } = useApp();
  const { settings } = data;
  const calendars = data.holidayCalendars ?? [];
  const mode = stateHolidayMode(settings);
  const thisYear = Number(todayIso().slice(0, 4));
  const years = calendars.map((c) => c.year);
  const [year, setYear] = useState(years.includes(thisYear) ? thisYear : (years.at(-1) ?? thisYear));
  const [checking, setChecking] = useState(false);
  const calendar = calendars.find((c) => c.year === year);
  const open = new Set(settings.openOnStateHolidays ?? []);
  const shown = (calendar?.holidays ?? []).filter((h) => mode === 'all' || h.list === 'public');
  const locale = lang === 'bn' ? 'bn-IN' : 'en-IN';

  const setOpen = (date: string, isOpen: boolean) => {
    const next = new Set(open);
    if (isOpen) next.add(date);
    else next.delete(date);
    return saveSettings({ openOnStateHolidays: [...next].sort() });
  };
  const checkNow = async () => {
    setChecking(true);
    try {
      await dataApi.refreshHolidays();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mt-2 border-t border-slate-100 pt-4">
      <div className="mb-1 text-sm font-medium text-slate-700">{t('stateCalendar')}</div>
      <p className="mb-3 text-sm leading-relaxed text-slate-600">{t('stateCalendarHint')}</p>
      <Segmented
        value={mode}
        onChange={(stateHolidays) => void saveSettings({ stateHolidays })}
        options={STATE_HOLIDAY_MODES.map((m) => ({ value: m, label: t(MODE_LABEL[m]) }))}
      />
      {mode !== 'off' && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="ghost" className="px-2" disabled={!years.includes(year - 1)} onClick={() => setYear(year - 1)} aria-label="Previous year">
              <ChevronLeft size={18} />
            </Button>
            <span className="min-w-14 text-center font-bold text-slate-900">{year}</span>
            <Button variant="ghost" className="px-2" disabled={!years.includes(year + 1)} onClick={() => setYear(year + 1)} aria-label="Next year">
              <ChevronRight size={18} />
            </Button>
            <Button className="ml-auto" disabled={checking} onClick={() => void checkNow()}>
              <RefreshCw size={16} className={checking ? 'animate-spin' : ''} /> {t('checkNow')}
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t(SOURCE_LABEL[calendar?.source ?? 'none'])}
            {calendar?.fetchedAt &&
              ` · ${t('updatedOn')} ${new Date(calendar.fetchedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
          {calendar && calendar.source !== 'none' && shown.length === 0 && <p className="mt-2 text-sm text-slate-500">{t('noStateHolidays')}</p>}
          {shown.length > 0 && (
            <ul className="mt-2 max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-slate-200">
              {shown.map((h) => {
                const isOpen = open.has(h.date);
                return (
                  <li key={`${h.date}-${h.list}-${h.name}`} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-28 shrink-0 text-sm text-slate-500">{prettyDate(h.date, lang)}</span>
                    <span className={`min-w-0 flex-1 text-sm ${isOpen ? 'text-slate-400 line-through' : 'font-medium text-slate-800'}`}>
                      {label(h.name)}
                      <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {t(h.list === 'public' ? 'listPublic' : 'listState')}
                      </span>
                      {isOpen && (
                        <span className="ml-1 inline-block rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800">{t('centreOpenTag')}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => void setOpen(h.date, !isOpen)}
                      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        isOpen ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                      }`}
                    >
                      {isOpen ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarX size={14} /> {t('markHoliday')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <CalendarCheck size={14} /> {t('markOpen')}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SnpMoneyCard() {
  const { t, data } = useApp();
  return (
    <Card title={t('snpMoneyTitle')}>
      <Toggle checked={data.settings.snpInPaise === true} onChange={(snpInPaise) => void saveSettings({ snpInPaise })} label={t('snpInPaise')} />
    </Card>
  );
}
