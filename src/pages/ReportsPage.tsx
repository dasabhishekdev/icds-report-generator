import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Cloud, FileDown, FileSpreadsheet, HardDrive, Loader2, Maximize2, Printer, Sparkles, Trash2 } from 'lucide-react';
import { dataApi } from '../api/data';
import { reportError } from '../api/http';
import { downloadReportFile, reportsApi, type GenerateRequest, type StoredReport } from '../api/reports';
import type { PaperSize } from '../db/schema';
import { currentMonth, daysBetweenInclusive, dotted, lastDateOfMonth, monthLabel, monthOf, todayIso } from '../domain/dates';
import { buildMonthSummary, buildPeriodSummary } from '../domain/month';
import { buildAllReports, REPORT_IDS, type ReportId } from '../reports';
import { PAPER_SIZES } from '../reports/paper';
import { rupees } from '../lib/format';
import { useApp } from '../state/AppDataContext';
import { SheetPreview, sheetWidthPx } from '../components/SheetPreview';
import { Button, ButtonLink, Card, Field, Flash, Segmented, Stat, TextInput, useFlash } from '../components/ui';
import { MonthSwitcher } from './MonthPage';

type Scope = 'month' | 'all';
type Mode = 'month' | 'range';

const MAX_RANGE_DAYS = 93;
const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function ReportsPage() {
  const { data, t, lang } = useApp();
  const paper: PaperSize = data.settings.paperSize ?? 'A4';
  const setPaper = (paperSize: PaperSize) => void dataApi.saveSettings({ paperSize });

  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(currentMonth());
  const [from, setFrom] = useState(`${currentMonth()}-01`);
  const [to, setTo] = useState(todayIso());
  const rangeError =
    mode === 'range'
      ? !from || !to
        ? t('rangeRequired')
        : to < from
          ? t('rangeOrder')
          : daysBetweenInclusive(from, to) > MAX_RANGE_DAYS
            ? t('rangeTooLong')
            : null
      : null;
  const period = mode === 'month' ? { from: `${month}-01`, to: lastDateOfMonth(month) } : { from, to };
  const listMonth = monthOf(period.from);

  const summary = useMemo(
    () => (mode === 'month' || rangeError ? buildMonthSummary(mode === 'month' ? month : listMonth, data) : buildPeriodSummary(from, to, data)),
    [mode, month, from, to, rangeError, listMonth, data],
  );
  const reports = useMemo(() => buildAllReports(summary, data.settings), [summary, data.settings]);
  const titleOf = (id: ReportId) => reports.find((r) => r.id === id)?.title ?? id;

  const [active, setActive] = useState(0);
  const [fit, setFit] = useState(true);
  const [busy, setBusy] = useState<'all' | ReportId | null>(null);
  const [scope, setScope] = useState<Scope>('month');
  const [saved, setSaved] = useState<StoredReport[] | null>(null);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const previewBox = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    const el = previewBox.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSaved(await reportsApi.list(scope === 'month' ? listMonth : undefined));
    } catch (e) {
      reportError(e);
      setSaved([]);
    }
  }, [listMonth, scope]);

  useEffect(() => {
    setSaved(null);
    void refresh();
  }, [refresh]);

  /** Generates on the server, saves it for the month and downloads the PDF straight away. */
  async function generate(sheets?: ReportId[]) {
    if (rangeError) return;
    setBusy(sheets?.length === 1 ? sheets[0] : 'all');
    try {
      const req: GenerateRequest = { ...period, paper, ...(sheets ? { sheets } : {}) };
      const report = await reportsApi.generate(req);
      setLatestId(report.id);
      setFlash(t('reportGenerated'));
      downloadReportFile(report.id, 'pdf');
      await refresh();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(null);
    }
  }

  async function remove(r: StoredReport) {
    if (!confirm(t('deleteReportConfirm'))) return;
    try {
      await reportsApi.remove(r.id);
      await refresh();
    } catch (e) {
      reportError(e);
    }
  }

  const today = todayIso();
  const unrecorded = summary.rows.filter((r) => r.status.kind === 'unrecorded' && r.date <= today);
  const drafts = summary.rows.filter((r) => r.served && !r.submitted);
  const current = reports[active];
  const zoom = fit && boxWidth ? Math.min(1, boxWidth / sheetWidthPx(current)) : 1;
  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'bn' ? 'bn-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const periodText = (p: { from: string; to: string }) =>
    p.from === `${monthOf(p.from)}-01` && p.to === lastDateOfMonth(monthOf(p.from)) ? monthLabel(monthOf(p.from), lang) : `${dotted(p.from)} – ${dotted(p.to)}`;
  const dayList = (rows: typeof summary.rows) => rows.map((r) => (summary.period.singleMonth ? r.day : dotted(r.date).slice(0, 5))).join(', ');

  return (
    <div className="space-y-4">
      <Card>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'month', label: t('wholeMonth') },
            { value: 'range', label: t('dateRange') },
          ]}
        />
        <div className="mt-3">
          {mode === 'month' ? (
            <MonthSwitcher month={month} onChange={setMonth} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('fromDate')}>
                <TextInput type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label={t('toDate')}>
                <TextInput type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
          )}
          {rangeError && <p className="mt-2 text-sm font-medium text-red-700">{rangeError}</p>}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('cookingDays')} value={summary.servedDays} tone="teal" />
        <Stat label={t('beneficiaryDays')} value={summary.beneficiaryDays} />
        <Stat label={t('vegEggCost')} value={rupees(summary.purchaseTotal)} tone="amber" />
      </div>

      {summary.servedDays === 0 && !rangeError && (
        <div className="flex gap-3 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
          <AlertTriangle size={20} className="shrink-0" />
          <div>{t('noAttendanceThisMonth')}</div>
        </div>
      )}

      {unrecorded.length > 0 && summary.servedDays > 0 && (
        <div className="flex gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle size={20} className="shrink-0" />
          <div>
            <div className="font-semibold">
              {t('unrecordedWarning')}: {unrecorded.length}
            </div>
            <div className="text-amber-800">{dayList(unrecorded)}</div>
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="flex gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">
          <AlertTriangle size={20} className="shrink-0" />
          <div>
            <div className="font-semibold">
              {t('draftWarning')}: {drafts.length}
            </div>
            <div className="text-red-800">{dayList(drafts)}</div>
          </div>
        </div>
      )}

      <Card
        title={t('generateReports')}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">{t('paperSize')}</span>
            <Segmented value={paper} onChange={setPaper} options={PAPER_SIZES.map((p) => ({ value: p, label: p }))} />
          </div>
        }
      >
        <p className="mb-3 text-sm text-slate-600">{t('generateHint')}</p>
        <Button
          variant="primary"
          className="w-full py-3 text-base sm:w-auto"
          disabled={busy !== null || rangeError !== null}
          onClick={() => void generate()}
        >
          {busy === 'all' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {busy === 'all' ? t('generating') : `${t('generateSave')} — ${periodText(period)} (${paper})`}
        </Button>
      </Card>

      <Card
        title={t('savedReports')}
        actions={
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'month', label: monthLabel(listMonth, lang) },
              { value: 'all', label: t('allMonths') },
            ]}
          />
        }
      >
        {saved === null ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> {t('preparing')}
          </div>
        ) : saved.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noSavedReports')}</p>
        ) : (
          <ul className="space-y-2">
            {saved.map((r) => (
              <li
                key={r.id}
                className={`rounded-xl p-3 ring-1 ${r.id === latestId ? 'bg-teal-50 ring-teal-300' : 'bg-slate-50 ring-slate-200'}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold text-slate-900">{periodText(r)}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{r.paper}</span>
                  <span className="text-xs text-slate-500">{when(r.createdAt)}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    {r.storage === 's3' ? <Cloud size={14} /> : <HardDrive size={14} />}
                    {r.storage === 's3' ? 'S3' : t('storedOnServer')}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {r.sheets.length === REPORT_IDS.length ? t('allFourRegisters') : r.sheets.map(titleOf).join(', ')} · {t('cookingDays')}:{' '}
                  {r.summary.servedDays} · {t('vegEggCost')}: {rupees(r.summary.purchaseTotal)}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ButtonLink variant="primary" href={reportsApi.fileUrl(r.id, 'pdf')} download>
                    <FileDown size={16} /> PDF ({kb(r.files.find((f) => f.kind === 'pdf')?.size ?? 0)})
                  </ButtonLink>
                  <ButtonLink href={reportsApi.fileUrl(r.id, 'xlsx')} download>
                    <FileSpreadsheet size={16} /> Excel
                  </ButtonLink>
                  <ButtonLink href={reportsApi.fileUrl(r.id, 'pdf', true)} target="_blank" rel="noopener">
                    <Printer size={16} /> {t('openPrint')}
                  </ButtonLink>
                  <Button variant="ghost" className="text-red-600" onClick={() => void remove(r)} aria-label={t('delete')}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:px-0">
        {reports.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActive(i)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
              i === active ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            {i + 1}. {r.title}
          </button>
        ))}
      </div>

      <Card
        title={`${t('preview')} — ${current.title}`}
        actions={
          <div className="flex gap-1">
            <Button variant="ghost" className="px-2" onClick={() => setFit(!fit)} aria-label={t('fitWidth')} title={t('fitWidth')}>
              <Maximize2 size={18} />
            </Button>
            <Button
              variant="primary"
              disabled={busy !== null || rangeError !== null}
              onClick={() => void generate([current.id as ReportId])}
              title={t('singlePdfHint')}
            >
              {busy === current.id ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} {t('thisReportPdf')}
            </Button>
          </div>
        }
      >
        <div ref={previewBox} className="overflow-auto rounded-lg bg-slate-100 ring-1 ring-slate-200">
          <div style={{ zoom }}>
            <SheetPreview model={current} />
          </div>
        </div>
      </Card>
      <Flash message={flash} />
    </div>
  );
}
