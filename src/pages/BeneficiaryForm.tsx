import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { dataApi, newId } from '../api/data';
import type { Beneficiary, ChildBeneficiary, Gender, MotherBeneficiary } from '../db/schema';
import { addMonths, currentMonth, monthLabel, monthName, shiftMonth, todayIso } from '../domain/dates';
import { nextChildShift, resolveCategory } from '../domain/eligibility';
import {
  babyAge,
  deliveryForBabyAge,
  dobForRegisterAge,
  eddForPregnancyMonth,
  exitAfterMonth,
  lastMonthBeforeExit,
  pregnancyMonth,
  registerAge,
} from '../domain/registerAge';
import { useApp } from '../state/AppDataContext';
import { Button, Field, Segmented, Select, TextInput } from '../components/ui';

type Stage = 'pregnant' | 'nursing';

/** Ages and months as the paper register writes them; '' means not known / not set. */
type Draft = {
  kind: 'child' | 'mother';
  name: string;
  gender: Gender;
  guardianName: string;
  husbandName: string;
  notes: string;
  registerMonth: string;
  ageYears: string;
  ageMonths: string;
  stage: Stage;
  pregnancyMonths: string;
  babyMonths: string;
  joinedMonth: string;
  lastMonth: string;
  /** Fields the user changed; untouched ones keep the record's exact dates. */
  touched: { age: boolean; mother: boolean; joined: boolean; left: boolean };
};

const pad = (n: number) => String(n).padStart(2, '0');

function deriveAge(b: Beneficiary | undefined, month: string): Pick<Draft, 'ageYears' | 'ageMonths'> {
  if (b?.kind !== 'child' || !b.dob) return { ageYears: '', ageMonths: '0' };
  const months = Math.max(0, registerAge(b.dob, month));
  return { ageYears: String(Math.floor(months / 12)), ageMonths: String(months % 12) };
}

function deriveMother(b: Beneficiary | undefined, month: string): Pick<Draft, 'stage' | 'pregnancyMonths' | 'babyMonths'> {
  if (b?.kind !== 'mother') return { stage: 'pregnant', pregnancyMonths: '', babyMonths: '0' };
  if (b.deliveryDate) return { stage: 'nursing', pregnancyMonths: '', babyMonths: String(Math.max(0, babyAge(b.deliveryDate, month))) };
  const months = b.expectedDeliveryDate ? pregnancyMonth(b.expectedDeliveryDate, month) : NaN;
  return { stage: 'pregnant', pregnancyMonths: months >= 1 && months <= 9 ? String(months) : '', babyMonths: '0' };
}

function toDraft(b: Beneficiary | undefined, kind: 'child' | 'mother'): Draft {
  const month = currentMonth();
  return {
    kind: b?.kind ?? kind,
    name: b?.name ?? '',
    gender: b?.kind === 'child' ? b.gender : 'M',
    guardianName: b?.kind === 'child' ? (b.guardianName ?? '') : '',
    husbandName: b?.kind === 'mother' ? (b.husbandName ?? '') : '',
    notes: b?.notes ?? '',
    registerMonth: month,
    ...deriveAge(b, month),
    ...deriveMother(b, month),
    joinedMonth: b ? b.enrolledOn.slice(0, 7) : month,
    lastMonth: b?.exitedOn ? lastMonthBeforeExit(b.exitedOn) : '',
    touched: { age: false, mother: false, joined: false, left: false },
  };
}

const opt = (s: string) => (s.trim() ? s.trim() : undefined);
const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** Month and year dropdowns (no native month input: iOS anchors it off-screen). */
function MonthSelect({ value, onChange, emptyLabel }: { value: string; onChange: (m: string) => void; emptyLabel?: string }) {
  const { lang } = useApp();
  const thisYear = Number(currentMonth().slice(0, 4));
  const year = value ? Number(value.slice(0, 4)) : thisYear;
  const years = range(Math.min(year, thisYear - 7), Math.max(year, thisYear + 1));
  return (
    <div className="grid grid-cols-[3fr_2fr] gap-2">
      <Select
        value={value ? value.slice(5, 7) : ''}
        onChange={(m) => onChange(m ? `${year}-${m}` : '')}
        options={[
          ...(emptyLabel ? [{ value: '', label: emptyLabel }] : []),
          ...range(1, 12).map((m) => ({ value: pad(m), label: monthName(m, lang) })),
        ]}
      />
      {value && (
        <Select
          value={String(year)}
          onChange={(y) => onChange(`${y}-${value.slice(5, 7)}`)}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
      )}
    </div>
  );
}

/** Today's category and the month of the next automatic move. */
function ChildCategoryPreview({ child }: { child: ChildBeneficiary }) {
  const { t, lang, data, label } = useApp();
  const today = todayIso();
  const { categories, settings } = data;
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const current = resolveCategory({ ...child, enrolledOn: today, exitedOn: undefined }, today, sorted, settings.nursingMonths);
  const shift = nextChildShift(child, today, sorted);
  const on = shift ? monthLabel(shift.on.slice(0, 7), lang) : '';
  const next = shift
    ? shift.to
      ? lang === 'bn'
        ? `${on} থেকে ${label(shift.to.name)}-এ যাবে`
        : `Moves to ${label(shift.to.name)} in ${on}`
      : lang === 'bn'
        ? `${on} থেকে বয়সসীমা পেরোবে`
        : `Ages out in ${on}`
    : null;
  return (
    <div className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900 ring-1 ring-teal-200">
      <div>
        {t('categoryToday')}: <b>{current ? label(current.name) : t('agedOut')}</b>
      </div>
      {next && <div className="text-xs text-teal-800">{next}</div>}
    </div>
  );
}

function MotherStagePreview({ mother }: { mother: MotherBeneficiary }) {
  const { lang, data } = useApp();
  if (mother.deliveryDate) {
    const last = monthLabel(shiftMonth(addMonths(mother.deliveryDate, data.settings.nursingMonths).slice(0, 7), -1), lang);
    return (
      <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
        {lang === 'bn' ? `${last} পর্যন্ত প্রসূতি হিসেবে গোনা হবে` : `Counted as nursing up to ${last}`}
      </div>
    );
  }
  if (!mother.expectedDeliveryDate) return null;
  const due = monthLabel(mother.expectedDeliveryDate.slice(0, 7), lang);
  return (
    <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
      {lang === 'bn' ? `সম্ভাব্য প্রসব: ${due}` : `Due around ${due}`}
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
  const edit = <K extends keyof Draft>(k: K, v: Draft[K], field: keyof Draft['touched']) =>
    setD((prev) => ({ ...prev, [k]: v, touched: { ...prev.touched, [field]: true } }));
  const setRegisterMonth = (month: string) =>
    setD((prev) => ({
      ...prev,
      registerMonth: month,
      ...(existing && !prev.touched.age ? deriveAge(existing, month) : {}),
      ...(existing && !prev.touched.mother ? deriveMother(existing, month) : {}),
    }));
  const hasAttendance = existing ? data.days.some((day) => day.presentIds.includes(existing.id)) : false;
  const changed = (field: keyof Draft['touched']) => !existing || d.touched[field];
  const valid = d.name.trim() !== '' && d.joinedMonth !== '' && d.registerMonth !== '';

  function build(): Beneficiary {
    const id = existing?.id ?? newId();
    const base = {
      id,
      name: d.name.trim(),
      enrolledOn: existing && !d.touched.joined ? existing.enrolledOn : `${d.joinedMonth}-01`,
      exitedOn: existing && !d.touched.left ? existing.exitedOn : d.lastMonth ? exitAfterMonth(d.lastMonth) : undefined,
      notes: opt(d.notes),
    };
    if (d.kind === 'child') {
      const ageInMonths = Number(d.ageYears) * 12 + Number(d.ageMonths);
      const dob = changed('age')
        ? d.ageYears === ''
          ? undefined
          : dobForRegisterAge(ageInMonths, d.registerMonth)
        : existing?.kind === 'child'
          ? existing.dob
          : undefined;
      return { ...base, kind: 'child', gender: d.gender, dob, guardianName: opt(d.guardianName) };
    }
    const kept = existing?.kind === 'mother' ? existing : undefined;
    const dates = !changed('mother')
      ? { expectedDeliveryDate: kept?.expectedDeliveryDate, deliveryDate: kept?.deliveryDate }
      : d.stage === 'nursing'
        ? { expectedDeliveryDate: kept?.expectedDeliveryDate, deliveryDate: deliveryForBabyAge(Number(d.babyMonths), d.registerMonth) }
        : {
            expectedDeliveryDate: d.pregnancyMonths ? eddForPregnancyMonth(Number(d.pregnancyMonths), d.registerMonth) : undefined,
            deliveryDate: undefined,
          };
    return { ...base, kind: 'mother', husbandName: opt(d.husbandName), ...dates };
  }

  async function save() {
    if (await dataApi.saveBeneficiary(build())) onDone();
  }

  async function remove() {
    if (!existing || !confirm(t('confirmDelete'))) return;
    if (await dataApi.deleteBeneficiary(existing.id)) onDone();
  }

  const draft = valid ? build() : null;
  const derivedYears = Number(d.ageYears || 0);
  const derivedBaby = Number(d.babyMonths || 0);

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

      <Field label={t('registerMonth')} hint={t('registerMonthHint')}>
        <MonthSelect value={d.registerMonth} onChange={setRegisterMonth} />
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
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={d.ageYears}
                onChange={(v) => edit('ageYears', v, 'age')}
                options={[
                  { value: '', label: `${t('years')}: ${t('notKnown')}` },
                  ...range(0, Math.max(6, derivedYears)).map((y) => ({ value: String(y), label: `${y} ${t('years')}` })),
                ]}
              />
              <Select
                value={d.ageMonths}
                onChange={(v) => edit('ageMonths', v, 'age')}
                options={range(0, 11).map((m) => ({ value: String(m), label: `${m} ${t('months')}` }))}
              />
            </div>
          </Field>
          {d.ageYears === '' && (
            <div role="alert" className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-300">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" />
              <span>{t('dobMissingForm')}</span>
            </div>
          )}
          {draft?.kind === 'child' && draft.dob && <ChildCategoryPreview child={draft} />}
          <Field label={t('guardian')}>
            <TextInput value={d.guardianName} onChange={(e) => set('guardianName', e.target.value)} />
          </Field>
        </>
      ) : (
        <>
          <Field label={t('motherKind')} hint={t('motherStageHint')}>
            <Segmented
              value={d.stage}
              onChange={(v) => edit('stage', v, 'mother')}
              options={[
                { value: 'pregnant', label: t('pregnant') },
                { value: 'nursing', label: t('nursing') },
              ]}
            />
          </Field>
          {d.stage === 'pregnant' ? (
            <Field label={t('monthsPregnant')}>
              <Select
                value={d.pregnancyMonths}
                onChange={(v) => edit('pregnancyMonths', v, 'mother')}
                options={[
                  { value: '', label: t('notKnown') },
                  ...range(1, 9).map((m) => ({ value: String(m), label: `${m} ${t('months')}` })),
                ]}
              />
            </Field>
          ) : (
            <Field label={t('babyAge')}>
              <Select
                value={d.babyMonths}
                onChange={(v) => edit('babyMonths', v, 'mother')}
                options={range(0, Math.max(data.settings.nursingMonths - 1, derivedBaby)).map((m) => ({
                  value: String(m),
                  label: `${m} ${t('months')}`,
                }))}
              />
            </Field>
          )}
          {draft?.kind === 'mother' && <MotherStagePreview mother={draft} />}
          <Field label={t('husband')}>
            <TextInput value={d.husbandName} onChange={(e) => set('husbandName', e.target.value)} />
          </Field>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('enrolledOn')}>
          <MonthSelect value={d.joinedMonth} onChange={(v) => edit('joinedMonth', v, 'joined')} />
        </Field>
        <Field label={t('exitedOn')} hint={t('exitHint')}>
          <MonthSelect value={d.lastMonth} onChange={(v) => edit('lastMonth', v, 'left')} emptyLabel={t('stillAtCentre')} />
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
