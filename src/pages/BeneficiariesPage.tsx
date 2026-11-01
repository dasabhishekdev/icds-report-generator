import { useMemo, useState } from 'react';
import { Baby, Plus, Search, TriangleAlert, UserRound } from 'lucide-react';
import type { Beneficiary, MotherBeneficiary } from '../db/schema';
import { ageInMonths, formatAge, formatMonths, monthLabel, monthOf, todayIso } from '../domain/dates';
import { childrenWithoutDob, isEnrolledOn, resolveCategory } from '../domain/eligibility';
import { babyAge, pregnancyMonth } from '../domain/registerAge';
import { useApp } from '../state/AppDataContext';
import { Button, Modal, Segmented, TextInput } from '../components/ui';
import { BeneficiaryForm } from './BeneficiaryForm';

type Filter = 'all' | 'mother' | 'child';
/** A category id, every category, or people in none (aged out, no age, left, not yet joined). */
type CategoryFilter = 'all' | 'none' | (string & {});

export function BeneficiariesPage() {
  const { data, t, lang, label } = useApp();
  const { beneficiaries, categories, settings } = data;
  const [filter, setFilter] = useState<Filter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ existing?: Beneficiary; kind: 'child' | 'mother' } | null>(null);
  const [missingDobOnly, setMissingDobOnly] = useState(false);
  const today = todayIso();
  const missingDob = useMemo(() => childrenWithoutDob(beneficiaries, today), [beneficiaries, today]);
  const showMissingOnly = missingDobOnly && missingDob.length > 0;

  const matching = useMemo(() => {
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

  const countIn = (id: CategoryFilter) =>
    id === 'all' ? matching.length : matching.filter((r) => (id === 'none' ? !r.category : r.category?.id === id)).length;
  const categoryChips: { id: CategoryFilter; text: string }[] = [
    { id: 'all', text: t('all') },
    ...[...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((c) => filter === 'all' || c.group === filter)
      .map((c) => ({ id: c.id, text: label(c.name) })),
    ...(countIn('none') > 0 ? [{ id: 'none' as const, text: t('noCategory') }] : []),
  ];
  const activeCategory = categoryChips.some((chip) => chip.id === categoryFilter) ? categoryFilter : 'all';
  const rows =
    activeCategory === 'all'
      ? matching
      : matching.filter((r) => (activeCategory === 'none' ? !r.category : r.category?.id === activeCategory));

  const month = monthOf(today);
  const motherDetail = (m: MotherBeneficiary) => {
    if (m.deliveryDate) {
      const baby = formatMonths(Math.max(0, babyAge(m.deliveryDate, month)), lang);
      return `${t('nursing')} · ${lang === 'bn' ? `শিশু ${baby}` : `baby ${baby}`}`;
    }
    if (!m.expectedDeliveryDate) return t('pregnant');
    const months = pregnancyMonth(m.expectedDeliveryDate, month);
    return months >= 1 && months <= 9
      ? `${t('pregnant')} · ${formatMonths(months, lang)}`
      : `${t('pregnant')} · ${t('edd')}: ${monthLabel(m.expectedDeliveryDate.slice(0, 7), lang)}`;
  };

  const badge = (r: (typeof rows)[number]) => {
    if (r.b.exitedOn && today >= r.b.exitedOn) return { text: t('exited'), cls: 'bg-slate-200 text-slate-600' };
    if (!r.enrolled) return { text: t('inactive'), cls: 'bg-slate-200 text-slate-600' };
    if (r.b.kind === 'child' && !r.b.dob) return { text: t('dobMissing'), cls: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' };
    if (!r.category) return { text: t('agedOut'), cls: 'bg-amber-100 text-amber-800' };
    if (!r.category.servesMeal) return { text: `${label(r.category.name)} · ${t('notServed')}`, cls: 'bg-sky-100 text-sky-800' };
    return { text: label(r.category.name), cls: r.b.kind === 'mother' ? 'bg-rose-100 text-rose-800' : 'bg-teal-100 text-teal-800' };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
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

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('ageCategoryFilter')}>
        {categoryChips.map((chip) => {
          const active = chip.id === activeCategory;
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={active}
              onClick={() => setCategoryFilter(chip.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
                active ? 'bg-teal-700 text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {chip.text} <span className={active ? 'text-teal-100' : 'text-slate-400'}>({countIn(chip.id)})</span>
            </button>
          );
        })}
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
                : [motherDetail(b), b.husbandName].filter(Boolean).join(' · ');
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ existing: b, kind: b.kind })}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 sm:gap-3 sm:px-4 sm:py-3"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${
                      b.kind === 'mother' ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-700'
                    }`}
                  >
                    {b.kind === 'mother' ? <UserRound size={20} /> : <Baby size={20} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{b.name}</span>
                    <span className="line-clamp-2 text-sm leading-snug text-slate-500">{detail}</span>
                  </span>
                  <span className={`max-w-[38%] shrink-0 rounded-full px-2 py-1 text-center text-[11px] leading-tight font-semibold sm:px-2.5 sm:text-xs ${bd.cls}`}>
                    {bd.text}
                  </span>
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
