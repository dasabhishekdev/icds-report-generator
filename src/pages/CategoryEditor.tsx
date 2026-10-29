import { useState } from 'react';
import { db } from '../db/db';
import { ITEM_KEYS, MEAL_TYPES, type Category, type ItemKey, type MealType } from '../db/schema';
import { ITEM_LABEL, MEAL_LABEL } from '../lib/format';
import { useApp } from '../state/AppDataContext';
import { Button, Field, NumberInput, Segmented, TextInput, Toggle } from '../components/ui';

const BUILT_IN = new Set(['pregnant', 'nursing']);

export function CategoryEditor({ category, isNew, onDone }: { category: Category; isNew: boolean; onDone: () => void }) {
  const { t, data } = useApp();
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
  const valid = c.name.trim() !== '' && (c.group === 'mother' || (c.maxMonths ?? 0) > (c.minMonths ?? 0));

  async function save() {
    await db.categories.put({ ...c, name: c.name.trim() });
    onDone();
  }

  async function remove() {
    if (!confirm(t('confirmDelete'))) return;
    await db.categories.delete(c.id);
    onDone();
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
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('fromMonths')}>
            <NumberInput value={c.minMonths} onChange={(v) => setC({ ...c, minMonths: v ?? 0 })} step="1" />
          </Field>
          <Field label={t('toMonths')}>
            <NumberInput value={c.maxMonths} onChange={(v) => setC({ ...c, maxMonths: v ?? 0 })} step="1" />
          </Field>
        </div>
      )}
      {overlaps && <p className="text-sm text-amber-700">⚠ Age range overlaps another child category.</p>}
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
