import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Save, Trash2 } from 'lucide-react';
import { dataApi, newId } from '../api/data';
import { STOCK_ITEM_KEYS, type StockItemKey } from '../db/schema';
import { currentMonth, todayIso, WEEKDAYS_BN, WEEKDAYS_EN, weekday } from '../domain/dates';
import { buildMonthSummary, openingStockFor, type AppData, type MonthSummary } from '../domain/month';
import { formatQty, rupees } from '../lib/format';
import { STOCK_LABEL, STOCK_LABEL_EN } from '../reports/common';
import { useApp } from '../state/AppDataContext';
import { Button, Card, Field, Flash, NumberInput, Segmented, Select, Stat, TextInput, useFlash } from '../components/ui';
import { MonthSwitcher } from '../components/MonthSwitcher';

type Tab = 'calendar' | 'stock' | 'fuel';

export function MonthPage() {
  const { data, t } = useApp();
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState<Tab>('calendar');
  const summary = useMemo(() => buildMonthSummary(month, data), [month, data]);

  return (
    <div className="space-y-4">
      <MonthSwitcher month={month} onChange={setMonth} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('cookingDays')} value={summary.servedDays} tone="teal" />
        <Stat label={t('beneficiaryDays')} value={summary.beneficiaryDays} />
        <Stat label={t('vegEggCost')} value={rupees(summary.purchaseTotal)} tone="amber" />
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'calendar', label: t('calendar') },
          { value: 'stock', label: t('stock') },
          { value: 'fuel', label: t('fuel') },
        ]}
      />
      {tab === 'calendar' && <CalendarGrid summary={summary} />}
      {tab === 'stock' && <StockPanel key={month} summary={summary} data={data} />}
      {tab === 'fuel' && <FuelPanel key={month} summary={summary} />}
    </div>
  );
}

function CalendarGrid({ summary }: { summary: MonthSummary }) {
  const { lang, t, label } = useApp();
  const navigate = useNavigate();
  const lead = weekday(summary.firstDate);
  const today = todayIso();
  const names = lang === 'bn' ? WEEKDAYS_BN : WEEKDAYS_EN;

  return (
    <Card>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
        {names.map((n) => (
          <div key={n} className="py-1">
            {n}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {summary.rows.map((row) => {
          const holiday = row.status.kind === 'holiday';
          const pending = row.status.kind === 'unrecorded' && row.date <= today;
          const cls = holiday
            ? 'bg-orange-50 text-orange-800 ring-1 ring-orange-200'
            : row.served
              ? row.meal === 'khichuri'
                ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                : 'bg-teal-50 text-teal-900 ring-1 ring-teal-200'
              : pending
                ? 'bg-white text-slate-400 border border-dashed border-slate-300'
                : 'bg-white text-slate-500 ring-1 ring-slate-200';
          return (
            <button
              key={row.date}
              type="button"
              onClick={() => navigate(`/?date=${row.date}`)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl p-0.5 transition hover:brightness-95 sm:aspect-[4/3] ${cls} ${
                row.date === today ? 'outline-2 outline-teal-600' : ''
              }`}
            >
              {row.served && !row.submitted && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" title={t('draft')} />
              )}
              <span className="text-sm font-bold">{row.day}</span>
              {holiday && <span className="max-w-full truncate text-[10px]">{row.status.label ? label(row.status.label) : t('holiday')}</span>}
              {row.served && (
                <span className="text-[10px] font-semibold sm:text-xs">
                  {row.meal === 'khichuri' ? '🍲' : '🍚'} {row.counts.total}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        <span>🍲 {t('khichuri')}</span>
        <span>🍚 {t('rice')}</span>
        <span className="text-orange-700">■ {t('holiday')}</span>
        <span className="text-slate-400">▢ {t('notRecorded')}</span>
        <span className="text-red-600">● {t('draft')}</span>
      </div>
    </Card>
  );
}

function StockPanel({ summary, data }: { summary: MonthSummary; data: AppData }) {
  const { t, lang } = useApp();
  const meta = data.monthMetas.find((m) => m.month === summary.month);
  const autoOpening = useMemo(() => {
    const withoutOverride: AppData = {
      ...data,
      monthMetas: data.monthMetas.map((m) => (m.month === summary.month ? { ...m, openingStock: undefined } : m)),
    };
    return openingStockFor(summary.month, withoutOverride);
  }, [data, summary.month]);
  const totals = (item: StockItemKey) => ({
    received: summary.rows.reduce((s, r) => s + r.receipts[item], 0),
    consumed: summary.rows.reduce((s, r) => s + r.consumption[item], 0),
  });
  const negative = STOCK_ITEM_KEYS.some((item) => summary.rows.some((r) => r.closing[item] < 0));
  const label = (item: StockItemKey) => (lang === 'bn' ? STOCK_LABEL[item] : STOCK_LABEL_EN[item]);

  const saved = meta?.openingStock ?? {};
  const [draft, setDraft] = useState<Partial<Record<StockItemKey, number>>>(saved);
  const [flash, setFlash] = useFlash();
  const dirty = STOCK_ITEM_KEYS.some((item) => draft[item] !== saved[item]);
  const setOpening = (item: StockItemKey, v: number | undefined) =>
    setDraft((prev) => {
      const next = { ...prev };
      if (v === undefined) delete next[item];
      else next[item] = v;
      return next;
    });

  async function save() {
    if (await dataApi.saveMonthMeta({ ...(meta ?? { month: summary.month }), openingStock: draft })) setFlash(t('saved'));
  }

  return (
    <div className="space-y-4">
      {negative && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200">{t('negativeStock')}</div>}
      <Card title={t('stock')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="mb-3 text-xs text-slate-500">{t('openingHint')}</p>
          <div className="space-y-3">
            {STOCK_ITEM_KEYS.map((item) => {
              const { received, consumed } = totals(item);
              const override = draft[item];
              return (
                <div key={item} className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 font-bold text-slate-800">{label(item)}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <div className="mb-1 text-xs text-slate-500">
                        {t('openingBalance')} {override === undefined && `(${t('auto')})`}
                      </div>
                      <NumberInput value={override} placeholder={String(autoOpening[item])} onChange={(v) => setOpening(item, v)} />
                    </div>
                    <MiniStat label={t('received')} value={formatQty(item, received, t)} />
                    <MiniStat label={t('consumed')} value={formatQty(item, consumed, t)} />
                    <MiniStat
                      label={t('closingBalance')}
                      value={formatQty(item, summary.closing[item], t)}
                      danger={summary.closing[item] < 0}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <SaveBar dirty={dirty} onCancel={() => setDraft(saved)} />
        </form>
        <Flash message={flash} />
      </Card>
      <ReceiptsCard key={summary.month} summary={summary} />
    </div>
  );
}

function MiniStat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs text-slate-500">{label}</div>
      <div className={`py-2 font-semibold tabular-nums ${danger ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function ReceiptsCard({ summary }: { summary: MonthSummary }) {
  const { t, lang } = useApp();
  const defaultDate = summary.month === currentMonth() ? todayIso() : summary.firstDate;
  const [date, setDate] = useState(defaultDate);
  const [item, setItem] = useState<StockItemKey>('rice');
  const [kg, setKg] = useState<number | undefined>();
  const [challan, setChallan] = useState('');
  const label = (k: StockItemKey) => (lang === 'bn' ? STOCK_LABEL[k] : STOCK_LABEL_EN[k]);
  const inMonth = date.startsWith(summary.month);

  async function add() {
    if (!kg || !inMonth) return;
    const ok = await dataApi.saveReceipt({
      id: newId(),
      date,
      item,
      quantity: Math.round(kg * 1000),
      challanNo: challan.trim() || undefined,
    });
    if (ok) setKg(undefined);
  }

  return (
    <Card title={t('received')}>
      {summary.receipts.length === 0 ? (
        <p className="text-sm text-slate-500">{t('noReceipts')}</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100">
          {summary.receipts.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className="w-24 text-sm text-slate-500">{r.date}</span>
              <span className="flex-1 font-semibold text-slate-800">
                {label(r.item)} · {formatQty(r.item, r.quantity, t)}
                {r.challanNo && <span className="ml-2 text-xs font-normal text-slate-500">#{r.challanNo}</span>}
              </span>
              <button type="button" onClick={() => {
                  if (confirm(t('confirmDelete'))) void dataApi.deleteReceipt(r.id);
                }} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={t('delete')}>
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Field label={t('date')}>
          <TextInput type="date" value={date} min={summary.firstDate} max={summary.lastDate} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('item')}>
          <Select value={item} onChange={setItem} options={STOCK_ITEM_KEYS.map((k) => ({ value: k, label: label(k) }))} />
        </Field>
        <Field label={t('quantityKg')} hint={kg ? `= ${formatQty(item, Math.round(kg * 1000), t)}` : undefined}>
          <NumberInput value={kg} onChange={setKg} />
        </Field>
        <Field label={t('challanNo')}>
          <TextInput value={challan} onChange={(e) => setChallan(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" variant="primary" className="w-full" disabled={!kg || !inMonth}>
            <Plus size={18} /> {t('add')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** The fuel register's item table: the daily fuel bill and the government supplies used this month. */
function FuelPanel({ summary }: { summary: MonthSummary }) {
  const { t, label } = useApp();
  const [bill, ...supplies] = summary.fuel;
  return (
    <Card title={t('fuelSpicesTitle')}>
      <p className="mb-3 text-xs text-slate-500">{t('fuelPanelHint')}</p>
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="mb-2 font-semibold text-slate-800">{t('fuelDailyLine')}</div>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label={t('cookingDays')} value={String(bill.quantity)} />
            <MiniStat label={t('rate')} value={rupees(bill.rate)} />
            <MiniStat label={t('amount')} value={rupees(bill.amount)} />
          </div>
        </div>
        {supplies.map((line) => (
          <div key={line.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
            <span className="min-w-0">
              <span className="block font-semibold text-slate-800">{label(line.name)}</span>
              <span className="text-xs text-slate-500">{t('govSuppliedUsed')}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">
              {line.quantity.toLocaleString('en-IN')} {line.unit}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-teal-50 px-3 py-2 font-bold text-teal-900">
        <span>{t('total')}</span>
        <span className="tabular-nums">{rupees(summary.fuelTotal)}</span>
      </div>
    </Card>
  );
}

/** Save / discard actions for a draft form; disabled until something changed. */
function SaveBar({ dirty, onCancel }: { dirty: boolean; onCancel: () => void }) {
  const { t } = useApp();
  return (
    <div
      className={`mt-4 flex items-center gap-2 ${
        dirty
          ? 'sticky bottom-3 z-20 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-amber-200 md:bottom-4'
          : ''
      }`}
    >
      <Button type="submit" variant="primary" disabled={!dirty} className="flex-1 sm:flex-none">
        <Save size={18} /> {t('save')}
      </Button>
      {dirty && (
        <Button onClick={onCancel}>
          {t('cancel')}
        </Button>
      )}
      {dirty && <span className="text-xs font-medium text-amber-700">{t('unsavedChanges')}</span>}
    </div>
  );
}
