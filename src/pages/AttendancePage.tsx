import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BadgeCheck, CalendarCheck, CheckCheck, ChevronLeft, ChevronRight, CircleCheck, Eraser, Pencil, Save, Send, TriangleAlert, UserPlus } from 'lucide-react';
import { dataApi } from '../api/data';
import { ITEM_KEYS, type Beneficiary, type DayRecord, type MealType } from '../db/schema';
import { countPresent, dayCosts, dayRation } from '../domain/calc';
import { addDays, ageInMonths, formatAge, prettyDate, toIso, todayIso } from '../domain/dates';
import { childrenWithoutDob, eligibleOn, motherStage } from '../domain/eligibility';
import { resolveDayStatus, submissionState, suggestMeal } from '../domain/month';
import { ITEM_LABEL, formatQty, rupees } from '../lib/format';
import { useApp } from '../state/AppDataContext';
import { Button, Card, Modal, Segmented, Stat, TextInput, Toggle } from '../components/ui';

function ReasonForm({ initial, onSave }: { initial: string; onSave: (v: string) => Promise<boolean> }) {
  const { t } = useApp();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const dirty = value.trim() !== initial.trim();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(value.trim()).then((ok) => setSaved(ok));
      }}
    >
      <TextInput
        placeholder={t('holidayReason')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
      />
      <Button type="submit" variant="primary" className="shrink-0" disabled={!dirty}>
        {saved && !dirty ? <CircleCheck size={18} /> : <Save size={18} />} {saved && !dirty ? t('saved') : t('save')}
      </Button>
    </form>
  );
}

export function AttendancePage() {
  const { data, t, lang, label } = useApp();
  const { settings, categories, beneficiaries, days } = data;
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? todayIso();
  const setDate = (d: string) => setParams(d === todayIso() ? {} : { date: d }, { replace: true });

  const record = days.find((d) => d.date === date);
  const status = resolveDayStatus(date, record, settings, data.holidayCalendars);
  const open = status.kind !== 'holiday';
  const meal: MealType = record?.meal ?? suggestMeal(date, days);
  const present = useMemo(() => new Set(record?.presentIds ?? []), [record]);
  const groups = useMemo(
    () => eligibleOn(beneficiaries, date, categories, settings.nursingMonths),
    [beneficiaries, date, categories, settings.nursingMonths],
  );
  const beneficiaryMap = useMemo(() => new Map(beneficiaries.map((b) => [b.id, b])), [beneficiaries]);
  const counts = countPresent([...present], date, beneficiaryMap, categories, settings.nursingMonths);
  const ration = dayRation(meal, counts.byCategory, categories);
  const costs = dayCosts(ration, settings.rates);

  async function save(patch: Partial<DayRecord>) {
    const base: DayRecord = record ?? {
      date,
      status: open ? 'working' : 'holiday',
      holidayReason: status.label,
      meal,
      presentIds: [],
      updatedAt: 0,
    };
    return dataApi.saveDay({ ...base, updatedAt: Date.now(), ...patch });
  }

  const submission = submissionState(record);
  const [confirming, setConfirming] = useState(false);
  const submit = async () => {
    const now = Date.now();
    if (await save({ status: 'working', meal, submittedAt: now, updatedAt: now })) setConfirming(false);
  };

  const toggle = (id: string) => {
    const next = new Set(present);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    void save({ status: 'working', presentIds: [...next] });
  };
  const setGroup = (members: Beneficiary[], on: boolean) => {
    const next = new Set(present);
    for (const m of members) {
      if (on) next.add(m.id);
      else next.delete(m.id);
    }
    void save({ status: 'working', presentIds: [...next] });
  };
  const allMembers = groups.flatMap((g) => g.members);
  /** People added later than this date are hidden here; backfilling an earlier month needs them enrolled. */
  const notYetEnrolled = beneficiaries.filter(
    (b) => date < b.enrolledOn && (!b.exitedOn || date < b.exitedOn) && (b.kind !== 'child' || (b.dob !== undefined && b.dob <= date)),
  );
  const missingDob = childrenWithoutDob(beneficiaries, date);
  const openOnStateHoliday = () =>
    dataApi.saveSettings({ openOnStateHolidays: [...new Set([...(settings.openOnStateHolidays ?? []), date])].sort() });
  const enrollFromDate = async () => {
    for (const b of notYetEnrolled) await dataApi.saveBeneficiary({ ...b, enrolledOn: date });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 min-[390px]:gap-2">
        <Button variant="ghost" className="shrink-0 px-2" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          <ChevronLeft />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-lg font-bold text-slate-900">{prettyDate(date, lang)}</div>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="mt-0.5 rounded-lg bg-transparent text-center text-sm text-slate-500"
          />
        </div>
        <Button variant="ghost" className="shrink-0 px-2" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
          <ChevronRight />
        </Button>
        {date !== todayIso() && (
          <Button variant="secondary" className="shrink-0 px-3" onClick={() => setDate(todayIso())}>
            {t('today')}
          </Button>
        )}
      </div>

      {open && submission === 'submitted' && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-white shadow-sm">
          <BadgeCheck size={28} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-bold">
              {t('submitted')} · <span className="whitespace-nowrap">{formatSubmitted(record!.submittedAt!, date, lang)}</span>
            </div>
            <div className="text-xs text-emerald-50">{t('submittedEditable')}</div>
          </div>
        </div>
      )}
      {open && submission === 'changed' && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-amber-900 ring-1 ring-amber-300">
          <Pencil size={24} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-bold">{t('changedAfterSubmit')}</div>
            <div className="text-xs">{t('changedHint')}</div>
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Toggle
            checked={open}
            onChange={(v) => void save({ status: v ? 'working' : 'holiday', holidayReason: v ? undefined : status.label })}
            label={open ? t('centreOpen') : t('holiday')}
          />
          {!record && open && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{t('notRecorded')}</span>}
          {record && submission === 'none' && open && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              <CircleCheck size={14} /> {t('draftSaved')}
            </span>
          )}
        </div>
        {!open && status.holidaySource === 'state' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900 ring-1 ring-orange-200">
            <span className="min-w-0 flex-1">
              <span className="mr-1 rounded-full bg-orange-200 px-2 py-0.5 text-xs font-semibold">{t('stateHolidayTag')}</span>
              {status.label && label(status.label)}
            </span>
            <Button className="shrink-0" onClick={() => void openOnStateHoliday()}>
              <CalendarCheck size={16} /> {t('markOpen')}
            </Button>
          </div>
        )}
        {!open && status.holidaySource !== 'state' && (
          <div className="mt-3">
            <ReasonForm
              key={date}
              initial={status.label ?? ''}
              onSave={(reason) => save({ status: 'holiday', holidayReason: reason || undefined })}
            />
          </div>
        )}
        {open && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-600">
              <span>{t('meal')}</span>
              {!record && <span className="text-xs text-slate-400">{t('suggested')}</span>}
            </div>
            <Segmented
              size="lg"
              value={meal}
              onChange={(m) => void save({ meal: m })}
              options={[
                { value: 'khichuri', label: `🍲 ${t('khichuri')}` },
                { value: 'rice', label: `🍚 ${t('rice')}` },
              ]}
            />
          </div>
        )}
      </Card>

      {open && (
        <>
          {missingDob.length > 0 && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-300">
              <TriangleAlert size={20} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <b>{missingDob.length}</b> {t('dobMissingBanner')} ({missingDob.map((b) => b.name).join(', ')})
              </span>
              <Link to="/people" className="shrink-0">
                <Button>{t('updateDob')}</Button>
              </Link>
            </div>
          )}
          {notYetEnrolled.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
              <span className="min-w-0 flex-1">
                <b>{notYetEnrolled.length}</b> {t('notEnrolledYet')}: {notYetEnrolled.map((b) => b.name).join(', ')}
              </span>
              <Button variant="primary" className="shrink-0" onClick={() => void enrollFromDate()}>
                {t('enrollFromDate')}
              </Button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('mothers')} value={counts.mothers} tone="rose" />
            <Stat label={t('children')} value={counts.children} tone="amber" />
            <Stat label={t('total')} value={counts.total} tone="teal" />
          </div>

          {allMembers.length === 0 ? (
            <Card>
              <p className="text-slate-600">{t('noEligible')}</p>
              <Link to="/people" className="mt-3 inline-flex">
                <Button variant="primary">
                  <UserPlus size={18} /> {t('addBeneficiaries')}
                </Button>
              </Link>
            </Card>
          ) : (
            <>
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" onClick={() => setGroup(allMembers, true)}>
                  <CheckCheck size={18} /> {t('allPresent')}
                </Button>
                <Button className="flex-1" onClick={() => setGroup(allMembers, false)}>
                  <Eraser size={18} /> {t('clearAll')}
                </Button>
              </div>
              {groups.map(({ category, members }) => {
                const n = members.filter((m) => present.has(m.id)).length;
                const allOn = n === members.length;
                return (
                  <Card
                    key={category.id}
                    title={
                      <span>
                        {label(category.name)}{' '}
                        <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-600">
                          {n}/{members.length}
                        </span>
                      </span>
                    }
                    actions={
                      <button
                        type="button"
                        className="text-sm font-semibold text-teal-700"
                        onClick={() => setGroup(members, !allOn)}
                      >
                        {allOn ? t('clearAll') : t('allPresent')}
                      </button>
                    }
                  >
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {members.map((m) => {
                        const on = present.has(m.id);
                        const sub =
                          m.kind === 'child'
                            ? `${m.gender === 'M' ? t('boy') : t('girl')}${m.dob ? ` · ${formatAge(ageInMonths(m.dob, date), lang)}` : ''}`
                            : motherStage(m, date, settings.nursingMonths) === 'nursing'
                              ? t('nursing')
                              : t('pregnant');
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggle(m.id)}
                            aria-pressed={on}
                            className={`flex min-h-14 items-center gap-2 rounded-xl px-2.5 py-2 text-left transition active:scale-[0.98] sm:px-3 ${
                              on ? 'bg-teal-600 text-white shadow' : 'bg-slate-50 text-slate-800 ring-1 ring-slate-200'
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                on ? 'bg-white text-teal-700' : 'bg-white ring-1 ring-slate-300'
                              }`}
                            >
                              {on && <CheckCheck size={14} />}
                            </span>
                            <span className="min-w-0">
                              <span className="line-clamp-2 text-sm leading-tight font-semibold break-words">{m.name}</span>
                              <span className={`block truncate text-xs ${on ? 'text-teal-50' : 'text-slate-500'}`}>{sub}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </>
          )}

          {counts.total > 0 && (
            <Card title={`${t('todaysRation')} — ${t(meal === 'khichuri' ? 'khichuri' : 'rice')}`}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ITEM_KEYS.filter((k) => ration.total[k] > 0).map((k) => (
                  <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">{t(ITEM_LABEL[k])}</div>
                    <div className="font-bold tabular-nums text-slate-900">{formatQty(k, ration.total[k], t)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-teal-50 px-3 py-2 text-teal-900">
                <span className="text-sm font-medium">{t('todaysCost')}</span>
                <span className="text-lg font-bold tabular-nums">{rupees(costs.total)}</span>
              </div>
            </Card>
          )}

          {submission !== 'submitted' && allMembers.length > 0 && (
            <div className="sticky bottom-3 z-20 md:bottom-4">
              <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
                <div className="min-w-0 flex-1 text-sm leading-tight text-slate-600">
                  <div className="font-bold text-slate-900">
                    {t('present')}: {counts.total}/{allMembers.length}
                  </div>
                  <div className="truncate">
                    {t('mothers')} {counts.mothers} · {t('children')} {counts.children} · {t(meal === 'khichuri' ? 'khichuri' : 'rice')}
                  </div>
                </div>
                <Button variant="primary" className="shrink-0 px-5" disabled={counts.total === 0} onClick={() => setConfirming(true)}>
                  <Send size={18} /> {submission === 'changed' ? t('resubmit') : t('submit')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={confirming} onClose={() => setConfirming(false)} title={t('confirmSubmitTitle')}>
        <p className="mb-3 text-sm text-slate-600">{t('confirmSubmitHint')}</p>
        <div className="mb-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div className="font-bold text-slate-900">{prettyDate(date, lang)}</div>
          <div className="text-sm text-slate-600">
            {t('meal')}: {meal === 'khichuri' ? `🍲 ${t('khichuri')}` : `🍚 ${t('rice')}`}
          </div>
        </div>
        <ul className="mb-3 divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200">
          {groups.map(({ category, members }) => {
            const n = members.filter((m) => present.has(m.id)).length;
            return (
              <li key={category.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-slate-700">{label(category.name)}</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {n}
                  <span className="font-normal text-slate-400">
                    {' '}
                    / {members.length}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Stat label={t('present')} value={counts.total} tone="teal" />
          <Stat label={t('absent')} value={allMembers.length - counts.total} tone="rose" />
          <Stat label={t('todaysCost')} value={rupees(costs.total)} tone="amber" />
        </div>
        <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-600">
          {ITEM_KEYS.filter((k) => ration.total[k] > 0).map((k) => (
            <span key={k} className="rounded-full bg-slate-100 px-2.5 py-1">
              {t(ITEM_LABEL[k])}: <b className="text-slate-800">{formatQty(k, ration.total[k], t)}</b>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => void submit()}>
            <BadgeCheck size={18} /> {t('confirmSubmit')}
          </Button>
          <Button onClick={() => setConfirming(false)}>{t('goBack')}</Button>
        </div>
      </Modal>
    </div>
  );
}

/** Time of submission, with the date too when it was submitted on a later day than the attendance date. */
function formatSubmitted(ts: number, attendanceDate: string, lang: 'bn' | 'en'): string {
  const locale = lang === 'bn' ? 'bn-IN' : 'en-IN';
  const d = new Date(ts);
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const sameDay = toIso(d.getFullYear(), d.getMonth() + 1, d.getDate()) === attendanceDate;
  return sameDay ? time : `${d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${time}`;
}
