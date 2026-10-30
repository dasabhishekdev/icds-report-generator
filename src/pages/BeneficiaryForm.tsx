import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { dataApi, newId } from '../api/data';
import type { Beneficiary, ChildBeneficiary, Gender } from '../db/schema';
import { monthOf, prettyDate, todayIso } from '../domain/dates';
import { nextChildShift, resolveCategory } from '../domain/eligibility';
import { useApp } from '../state/AppDataContext';
import { Button, Field, Segmented, TextInput } from '../components/ui';

type Draft = {
  kind: 'child' | 'mother';
  name: string;
  gender: Gender;
  dob: string;
  guardianName: string;
  husbandName: string;
  expectedDeliveryDate: string;
  deliveryDate: string;
  enrolledOn: string;
  exitedOn: string;
  notes: string;
};

function toDraft(b: Beneficiary | undefined, kind: 'child' | 'mother'): Draft {
  const blank: Draft = {
    kind,
    name: '',
    gender: 'M',
    dob: '',
    guardianName: '',
    husbandName: '',
    expectedDeliveryDate: '',
    deliveryDate: '',
    enrolledOn: `${monthOf(todayIso())}-01`,
    exitedOn: '',
    notes: '',
  };
  if (!b) return blank;
  const common = { ...blank, kind: b.kind, name: b.name, enrolledOn: b.enrolledOn, exitedOn: b.exitedOn ?? '', notes: b.notes ?? '' };
  return b.kind === 'child'
    ? { ...common, gender: b.gender, dob: b.dob ?? '', guardianName: b.guardianName ?? '' }
    : { ...common, husbandName: b.husbandName ?? '', expectedDeliveryDate: b.expectedDeliveryDate ?? '', deliveryDate: b.deliveryDate ?? '' };
}

const opt = (s: string) => (s.trim() ? s.trim() : undefined);

/** Today's category and the next automatic move, worked out from the date of birth being typed. */
function ChildCategoryPreview({ child }: { child: ChildBeneficiary }) {
  const { t, lang, data } = useApp();
  const today = todayIso();
  const { categories, settings } = data;
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const current = resolveCategory({ ...child, enrolledOn: today, exitedOn: undefined }, today, sorted, settings.nursingMonths);
  const shift = nextChildShift(child, today, sorted);
  const on = shift ? prettyDate(shift.on, lang) + ` ${shift.on.slice(0, 4)}` : '';
  const next = shift
    ? shift.to
      ? lang === 'bn'
        ? `${on} থেকে ${shift.to.name}-এ যাবে`
        : `Moves to ${shift.to.name} on ${on}`
      : lang === 'bn'
        ? `${on} থেকে বয়সসীমা পেরোবে`
        : `Ages out on ${on}`
    : null;
  return (
    <div className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900 ring-1 ring-teal-200">
      <div>
        {t('categoryToday')}: <b>{current?.name ?? t('agedOut')}</b>
      </div>
      {next && <div className="text-xs text-teal-800">{next}</div>}
    </div>
  );
}

export function BeneficiaryForm({
  existing,
  initialKind,
  onDone,
}: {
  existing?: Beneficiary;
  initialKind: 'child' | 'mother';
  onDone: () => void;
}) {
  const { t, data } = useApp();
  const [d, setD] = useState<Draft>(() => toDraft(existing, initialKind));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));
  const hasAttendance = existing ? data.days.some((day) => day.presentIds.includes(existing.id)) : false;
  const today = todayIso();
  const dobInFuture = d.kind === 'child' && d.dob !== '' && d.dob > today;
  const valid = d.name.trim() !== '' && d.enrolledOn !== '' && !dobInFuture;

  function build(): Beneficiary {
    const id = existing?.id ?? newId();
    const base = { id, name: d.name.trim(), enrolledOn: d.enrolledOn, exitedOn: opt(d.exitedOn), notes: opt(d.notes) };
    return d.kind === 'child'
      ? { ...base, kind: 'child', gender: d.gender, dob: opt(d.dob), guardianName: opt(d.guardianName) }
      : {
          ...base,
          kind: 'mother',
          husbandName: opt(d.husbandName),
          expectedDeliveryDate: opt(d.expectedDeliveryDate),
          deliveryDate: opt(d.deliveryDate),
        };
  }

  async function save() {
    if (await dataApi.saveBeneficiary(build())) onDone();
  }

  async function remove() {
    if (!existing || !confirm(t('confirmDelete'))) return;
    if (await dataApi.deleteBeneficiary(existing.id)) onDone();
  }

  const draftChild = d.kind === 'child' && d.dob && !dobInFuture ? (build() as ChildBeneficiary) : null;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void save();
      }}
    >
      {!existing && (
        <Segmented
          value={d.kind}
          onChange={(v) => set('kind', v)}
          options={[
            { value: 'child', label: t('childKind') },
            { value: 'mother', label: t('motherKind') },
          ]}
        />
      )}
      <Field label={t('name')}>
        <TextInput value={d.name} onChange={(e) => set('name', e.target.value)} autoFocus required />
      </Field>

      {d.kind === 'child' ? (
        <>
          <Field label={t('gender')}>
            <Segmented
              value={d.gender}
              onChange={(v) => set('gender', v)}
              options={[
                { value: 'M', label: t('boy') },
                { value: 'F', label: t('girl') },
              ]}
            />
          </Field>
          <Field label={t('dob')}>
            <TextInput
              type="date"
              value={d.dob}
              max={today}
              onChange={(e) => set('dob', e.target.value)}
              className={d.dob === '' || dobInFuture ? 'ring-2 ring-amber-400' : ''}
            />
          </Field>
          {d.dob === '' && (
            <div role="alert" className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-300">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" />
              <span>{t('dobMissingForm')}</span>
            </div>
          )}
          {dobInFuture && <p className="text-sm text-red-700">⚠ {t('dobInFuture')}</p>}
          {draftChild && <ChildCategoryPreview child={draftChild} />}
          <Field label={t('guardian')}>
            <TextInput value={d.guardianName} onChange={(e) => set('guardianName', e.target.value)} />
          </Field>
        </>
      ) : (
        <>
          <Field label={t('husband')}>
            <TextInput value={d.husbandName} onChange={(e) => set('husbandName', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('edd')}>
              <TextInput type="date" value={d.expectedDeliveryDate} onChange={(e) => set('expectedDeliveryDate', e.target.value)} />
            </Field>
            <Field label={t('deliveryDate')} hint={t('deliveryHint')}>
              <TextInput type="date" value={d.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
            </Field>
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('enrolledOn')}>
          <TextInput type="date" value={d.enrolledOn} onChange={(e) => set('enrolledOn', e.target.value)} required />
        </Field>
        <Field label={t('exitedOn')} hint={t('exitHint')}>
          <TextInput type="date" value={d.exitedOn} onChange={(e) => set('exitedOn', e.target.value)} />
        </Field>
      </div>
      <Field label={t('notes')}>
        <TextInput value={d.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={!valid} className="flex-1">
          {t('save')}
        </Button>
        <Button onClick={onDone}>{t('cancel')}</Button>
        {existing && !hasAttendance && (
          <Button variant="danger" onClick={() => void remove()}>
            {t('delete')}
          </Button>
        )}
      </div>
      {existing && hasAttendance && <p className="text-xs text-slate-500">{t('hasAttendance')}</p>}
    </form>
  );
}
