import { useState } from 'react';
import { db, newId } from '../db/db';
import type { Beneficiary, Gender } from '../db/schema';
import { monthOf, todayIso } from '../domain/dates';
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
    ? { ...common, gender: b.gender, dob: b.dob, guardianName: b.guardianName ?? '' }
    : { ...common, husbandName: b.husbandName ?? '', expectedDeliveryDate: b.expectedDeliveryDate ?? '', deliveryDate: b.deliveryDate ?? '' };
}

const opt = (s: string) => (s.trim() ? s.trim() : undefined);

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
  const valid = d.name.trim() !== '' && d.enrolledOn !== '' && (d.kind === 'mother' || d.dob !== '');

  async function save() {
    const id = existing?.id ?? newId();
    const base = { id, name: d.name.trim(), enrolledOn: d.enrolledOn, exitedOn: opt(d.exitedOn), notes: opt(d.notes) };
    const record: Beneficiary =
      d.kind === 'child'
        ? { ...base, kind: 'child', gender: d.gender, dob: d.dob, guardianName: opt(d.guardianName) }
        : {
            ...base,
            kind: 'mother',
            husbandName: opt(d.husbandName),
            expectedDeliveryDate: opt(d.expectedDeliveryDate),
            deliveryDate: opt(d.deliveryDate),
          };
    await db.beneficiaries.put(record);
    onDone();
  }

  async function remove() {
    if (!existing || !confirm(t('confirmDelete'))) return;
    await db.beneficiaries.delete(existing.id);
    onDone();
  }

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
            <TextInput type="date" value={d.dob} onChange={(e) => set('dob', e.target.value)} required />
          </Field>
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
