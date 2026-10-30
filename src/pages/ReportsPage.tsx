import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ChevronRight, FileDown, FileSpreadsheet, FolderOpen, Loader2, Maximize2, Sparkles } from 'lucide-react';
import { dataApi } from '../api/data';
import { reportError } from '../api/http';
import { downloadReportFile, reportsApi, type GenerateRequest, type ReportFileKind } from '../api/reports';
import type { PaperSize } from '../db/schema';
import { currentMonth, daysBetweenInclusive, dotted, lastDateOfMonth, monthLabel, monthOf, todayIso } from '../domain/dates';
import { buildMonthSummary, buildPeriodSummary } from '../domain/month';
import { buildAllReports, type ReportId } from '../reports';
import { PAPER_SIZES } from '../reports/paper';
import { periodText as formatPeriod, rupees } from '../lib/format';
import { useApp } from '../state/AppDataContext';
import { SheetPreview, sheetWidthPx } from '../components/SheetPreview';
import { Button, Card, Field, Flash, Segmented, Stat, TextInput, useFlash } from '../components/ui';
import { MonthSwitcher } from './MonthPage';

type Mode = 'month' | 'range';

const MAX_RANGE_DAYS = 93;

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

  const [active, setActive] = useState(0);
  const [fit, setFit] = useState(true);
  const [busy, setBusy] = useState<{ scope: 'all' | ReportId; kind: ReportFileKind } | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
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

  const refreshCount = useCallback(async () => {
    try {
      setSavedCount((await reportsApi.list(listMonth)).length);
    } catch {
      setSavedCount(null);
    }
  }, [listMonth]);

  useEffect(() => {
    setSavedCount(null);
    void refreshCount();
  }, [refreshCount]);

  /** Generates PDF and Excel on the server, saves both for the month and downloads the chosen one. */
  async function generate(kind: ReportFileKind, sheets?: ReportId[]) {
    if (rangeError) return;
    setBusy({ scope: sheets?.length === 1 ? sheets[0] : 'all', kind });
    try {
      const req: GenerateRequest = { ...period, paper, ...(sheets ? { sheets } : {}) };
      const report = await reportsApi.generate(req);
      setLatestId(report.id);
      setFlash(t('reportGenerated'));
      downloadReportFile(report.id, kind);
      await refreshCount();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(null);
    }
  }

  const isBusy = (scope: 'all' | string, kind: ReportFileKind) => busy?.scope === scope && busy.kind === kind;
  const today = todayIso();
  const unrecorded = summary.rows.filter((r) => r.status.kind === 'unrecorded' && r.date <= today);
  const drafts = summary.rows.filter((r) => r.served && !r.submitted);
  const current = reports[active];
  const zoom = fit && boxWidth ? Math.min(1, boxWidth / sheetWidthPx(current)) : 1;
  const periodText = (p: { from: string; to: string }) => formatPeriod(p, lang);
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            className="w-full py-3 text-base sm:w-auto"
            disabled={busy !== null || rangeError !== null}
            onClick={() => void generate('pdf')}
          >
            {isBusy('all', 'pdf') ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {isBusy('all', 'pdf') ? t('generating') : `${t('generateSave')} — ${periodText(period)} (${paper})`}
          </Button>
          <Button
            className="w-full py-3 text-base sm:w-auto"
            disabled={busy !== null || rangeError !== null}
            onClick={() => void generate('xlsx')}
            title={t('excelHint')}
          >
            {isBusy('all', 'xlsx') ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
            {isBusy('all', 'xlsx') ? t('generating') : t('downloadExcel')}
          </Button>
        </div>
      </Card>

      <Link
        to={`/reports/saved?month=${listMonth}${latestId ? `&highlight=${latestId}` : ''}`}
        className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <FolderOpen size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-slate-900">{t('viewSavedReports')}</span>
          <span className="block text-sm text-slate-500">
            {savedCount === null ? '…' : savedCount} {t('savedThisMonth')} · {monthLabel(listMonth, lang)}
          </span>
        </span>
        <ChevronRight size={20} className="text-slate-400" />
      </Link>

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
              onClick={() => void generate('pdf', [current.id as ReportId])}
              title={t('singlePdfHint')}
            >
              {isBusy(current.id, 'pdf') ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} {t('thisReportPdf')}
            </Button>
            <Button
              disabled={busy !== null || rangeError !== null}
              onClick={() => void generate('xlsx', [current.id as ReportId])}
              title={t('singleExcelHint')}
            >
              {isBusy(current.id, 'xlsx') ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} {t('thisReportExcel')}
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
