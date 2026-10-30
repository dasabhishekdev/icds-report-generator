import { useMemo, useState } from 'react';
import { Baby, Plus, Search, TriangleAlert, UserRound } from 'lucide-react';
import type { Beneficiary } from '../db/schema';
import { ageInMonths, formatAge, todayIso } from '../domain/dates';
import { childrenWithoutDob, isEnrolledOn, resolveCategory } from '../domain/eligibility';
import { useApp } from '../state/AppDataContext';
import { Button, Modal, Segmented, TextInput } from '../components/ui';
import { BeneficiaryForm } from './BeneficiaryForm';

type Filter = 'all' | 'mother' | 'child';

export function BeneficiariesPage() {
  const { data, t, lang } = useApp();
  const { beneficiaries, categories, settings } = data;
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ existing?: Beneficiary; kind: 'child' | 'mother' } | null>(null);
  const [missingDobOnly, setMissingDobOnly] = useState(false);
  const today = todayIso();
  const missingDob = useMemo(() => childrenWithoutDob(beneficiaries, today), [beneficiaries, today]);
  const showMissingOnly = missingDobOnly && missingDob.length > 0;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return beneficiaries
      .filter((b) => filter === 'all' || b.kind === filter)
      .filter((b) => !q || b.name.toLowerCase().includes(q))
      .filter((b) => !showMissingOnly || (b.kind === 'child' && !b.dob))
      .map((b) => {
        const category = resolveCategory(b, today, categories, settings.nursingMonths);
        const enrolled = isEnrolledOn(b, today);
        return { b, category, enrolled };
      })
      .sort((x, y) => {
        const rank = (r: typeof x) => (r.category ? r.category.sortOrder : 99);
        return rank(x) - rank(y) || x.b.name.localeCompare(y.b.name);
      });
  }, [beneficiaries, filter, query, showMissingOnly, categories, settings.nursingMonths, today]);

  const badge = (r: (typeof rows)[number]) => {
    if (r.b.exitedOn && today >= r.b.exitedOn) return { text: t('exited'), cls: 'bg-slate-200 text-slate-600' };
    if (!r.enrolled) return { text: t('inactive'), cls: 'bg-slate-200 text-slate-600' };
    if (r.b.kind === 'child' && !r.b.dob) return { text: t('dobMissing'), cls: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' };
    if (!r.category) return { text: t('agedOut'), cls: 'bg-amber-100 text-amber-800' };
    if (!r.category.servesMeal) return { text: `${r.category.name} · ${t('notServed')}`, cls: 'bg-sky-100 text-sky-800' };
    return { text: r.category.name, cls: r.b.kind === 'mother' ? 'bg-rose-100 text-rose-800' : 'bg-teal-100 text-teal-800' };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">
          {t('navPeople')} <span className="text-slate-400">({beneficiaries.length})</span>
        </h1>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setEditing({ kind: 'child' })}>
            <Plus size={18} /> {t('addChild')}
          </Button>
          <Button onClick={() => setEditing({ kind: 'mother' })}>
            <Plus size={18} /> {t('addMother')}
          </Button>
        </div>
      </div>

      {missingDob.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-300">
          <TriangleAlert size={20} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <b>{missingDob.length}</b> {t('dobMissingBanner')}
          </span>
          <Button className="shrink-0" onClick={() => setMissingDobOnly(!showMissingOnly)}>
            {showMissingOnly ? t('showAll') : t('showThem')}
          </Button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <TextInput className="pl-10" placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('all') },
            { value: 'mother', label: t('mothers') },
            { value: 'child', label: t('children') },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">{t('noBeneficiaries')}</div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {rows.map((r) => {
            const { b } = r;
            const bd = badge(r);
            const detail =
              b.kind === 'child'
                ? `${b.gender === 'M' ? t('boy') : t('girl')} · ${b.dob ? formatAge(ageInMonths(b.dob, today), lang) : t('dobMissing')}${b.guardianName ? ` · ${b.guardianName}` : ''}`
                : b.deliveryDate
                  ? `${t('deliveryDate')}: ${b.deliveryDate}`
                  : b.expectedDeliveryDate
                    ? `${t('edd')}: ${b.expectedDeliveryDate}`
                    : b.husbandName ?? '';
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ existing: b, kind: b.kind })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      b.kind === 'mother' ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-700'
                    }`}
                  >
                    {b.kind === 'mother' ? <UserRound size={20} /> : <Baby size={20} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{b.name}</span>
                    <span className="block truncate text-sm text-slate-500">{detail}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${bd.cls}`}>{bd.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.existing ? t('edit') : editing?.kind === 'mother' ? t('addMother') : t('addChild')}
      >
        {editing && (
          <BeneficiaryForm
            key={editing.existing?.id ?? editing.kind}
            existing={editing.existing}
            initialKind={editing.kind}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
