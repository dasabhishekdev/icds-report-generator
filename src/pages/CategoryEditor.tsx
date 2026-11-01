import { useState } from 'react';
import { dataApi } from '../api/data';
import { ITEM_KEYS, MEAL_TYPES, PURCHASED_ITEM_KEYS, type Category, type ItemKey, type MealType, type PurchasedItemKey } from '../db/schema';
import { itemCost } from '../domain/calc';
import { formatMonths } from '../domain/dates';
import { ITEM_LABEL, MEAL_LABEL, rupees } from '../lib/format';
import { useApp } from '../state/AppDataContext';
import { Button, Field, NumberInput, Segmented, Select, TextInput, Toggle } from '../components/ui';

const BUILT_IN = new Set(['pregnant', 'nursing']);
const isPurchased = (item: ItemKey): item is PurchasedItemKey => (PURCHASED_ITEM_KEYS as readonly string[]).includes(item);

/** The ICDS supplementary-nutrition age groups, in months. */
const AGE_PRESETS: readonly [number, number][] = [
  [0, 6],
  [6, 36],
  [36, 72],
];
const MAX_YEARS = 18;

function AgeInput({ label, months, onChange }: { label: string; months: number; onChange: (months: number) => void }) {
  const { t } = useApp();
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const option = (n: number) => ({ value: String(n), label: String(n) });
  return (
    <Field label={label}>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2">
          <Select
            value={String(years)}
            onChange={(v) => onChange(Number(v) * 12 + rest)}
            options={Array.from({ length: MAX_YEARS + 1 }, (_, i) => option(i))}
          />
          <span className="text-sm text-slate-600">{t('years')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(rest)} onChange={(v) => onChange(years * 12 + Number(v))} options={Array.from({ length: 12 }, (_, i) => option(i))} />
          <span className="text-sm text-slate-600">{t('months')}</span>
        </div>
      </div>
    </Field>
  );
}

export function CategoryEditor({ category, isNew, onDone }: { category: Category; isNew: boolean; onDone: () => void }) {
  const { t, data, lang } = useApp();
  const [c, setC] = useState<Category>(category);
  const setNorm = (meal: MealType, item: ItemKey, v: number | undefined) =>
    setC((prev) => ({ ...prev, norms: { ...prev.norms, [meal]: { ...prev.norms[meal], [item]: v ?? 0 } } }));

  const overlaps =
    c.group === 'child' &&
    data.categories.some(
      (o) =>
        o.id !== c.id &&
        o.group === 'child' &&
        (o.minMonths ?? 0) < (c.maxMonths ?? Infinity) &&
        (c.minMonths ?? 0) < (o.maxMonths ?? Infinity),
    );
  const rangeValid = c.group === 'mother' || (c.maxMonths ?? 0) > (c.minMonths ?? 0);
  const valid = c.name.trim() !== '' && rangeValid;

  async function save() {
    if (await dataApi.saveCategory({ ...c, name: c.name.trim() })) onDone();
  }

  async function remove() {
    if (!confirm(t('confirmDelete'))) return;
    if (await dataApi.deleteCategory(c.id)) onDone();
  }

  return (
    <div className="space-y-4">
      <Field label={t('name')}>
        <TextInput value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
      </Field>
      {isNew && (
        <Field label={t('group')}>
          <Segmented
            value={c.group}
            onChange={(group) => setC({ ...c, group, motherStage: group === 'mother' ? 'pregnant' : undefined })}
            options={[
              { value: 'child', label: t('childKind') },
              { value: 'mother', label: t('motherKind') },
            ]}
          />
        </Field>
      )}
      {c.group === 'mother' ? (
        <Field label={t('stage')}>
          <Segmented
            value={c.motherStage ?? 'pregnant'}
            onChange={(motherStage) => setC({ ...c, motherStage })}
            options={[
              { value: 'pregnant', label: t('pregnant') },
              { value: 'nursing', label: t('nursing') },
            ]}
          />
        </Field>
      ) : (
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-700">{t('ageRange')}</div>
          <div className="flex flex-wrap gap-2">
            {AGE_PRESETS.map(([min, max]) => {
              const active = c.minMonths === min && c.maxMonths === max;
              return (
                <button
                  key={`${min}-${max}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setC({ ...c, minMonths: min, maxMonths: max })}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${active ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  {formatMonths(min, lang)} – {formatMonths(max, lang)}
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <AgeInput label={t('ageFrom')} months={c.minMonths ?? 0} onChange={(minMonths) => setC({ ...c, minMonths })} />
            <AgeInput label={t('ageTo')} months={c.maxMonths ?? 0} onChange={(maxMonths) => setC({ ...c, maxMonths })} />
          </div>
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900 ring-1 ring-sky-200">{t('ageRangeRule')}</p>
          {!rangeValid && <p className="text-sm text-red-700">⚠ {t('ageRangeInvalid')}</p>}
        </div>
      )}
      {overlaps && <p className="text-sm text-amber-700">⚠ {t('ageRangeOverlap')}</p>}
      <Toggle checked={c.servesMeal} onChange={(servesMeal) => setC({ ...c, servesMeal })} label={t('servesMeal')} />

      {c.servesMeal && (
        <div>
          <p className="mb-2 text-xs text-slate-500">{t('normsHint')}</p>
          <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">{t('item')}</th>
                  {MEAL_TYPES.map((m) => (
                    <th key={m} className="px-2 py-2 text-left">
                      {t(MEAL_LABEL[m])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {ITEM_KEYS.map((item) => (
                  <tr key={item}>
                    <td className="px-3 py-1.5 font-medium text-slate-700">
                      {t(ITEM_LABEL[item])} <span className="text-xs text-slate-400">({item === 'egg' ? t('pcs') : t('grams')})</span>
                    </td>
                    {MEAL_TYPES.map((m) => (
                      <td key={m} className="px-2 py-1.5">
                        <NumberInput value={c.norms[m][item]} onChange={(v) => setNorm(m, item, v)} className="py-1.5" />
                        {isPurchased(item) && (
                          <div className="mt-0.5 text-right text-xs text-slate-500 tabular-nums">
                            = {rupees(itemCost(item, c.norms[m][item], data.settings.rates))}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-teal-700"
            onClick={() => setC({ ...c, norms: { ...c.norms, rice: { ...c.norms.khichuri } } })}
          >
            {t('copyKhichuriToRice')}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="primary" className="flex-1" disabled={!valid} onClick={() => void save()}>
          {t('save')}
        </Button>
        <Button onClick={onDone}>{t('cancel')}</Button>
        {!isNew && !BUILT_IN.has(c.id) && (
          <Button variant="danger" onClick={() => void remove()}>
            {t('delete')}
          </Button>
        )}
      </div>
    </div>
  );
}
