import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, FileDown, FileSpreadsheet, Maximize2, Printer } from 'lucide-react';
import { db } from '../db/db';
import type { PaperSize } from '../db/schema';
import { currentMonth, monthShort, todayIso } from '../domain/dates';
import { buildMonthSummary } from '../domain/month';
import { buildAllReports } from '../reports';
import { workbookBlob } from '../reports/excel';
import { PAPER_SIZES, pageMm, PRINT_MARGIN_MM, printableWidthPx } from '../reports/paper';
import { sheetsToPdf } from '../reports/pdf';
import type { SheetModel } from '../reports/sheet';
import { downloadBlob } from '../lib/download';
import { rupees } from '../lib/format';
import { useApp } from '../state/AppDataContext';
import { SheetPreview, sheetWidthPx } from '../components/SheetPreview';
import { Button, Card, Segmented, Stat } from '../components/ui';
import { MonthSwitcher } from './MonthPage';

/** Zoom that fits a rendered sheet inside the printable area of one page. */
function printZoom(model: SheetModel, heightPx: number, paper: PaperSize): number {
  const { h } = pageMm(paper, model.landscape);
  const maxH = Math.floor(((h - PRINT_MARGIN_MM * 2) / 25.4) * 96) - 8;
  const byWidth = printableWidthPx(paper, model.landscape) / sheetWidthPx(model);
  return Math.min(byWidth, heightPx ? maxH / heightPx : byWidth);
}

export function ReportsPage() {
  const { data, t } = useApp();
  const paper: PaperSize = data.settings.paperSize ?? 'A4';
  const setPaper = (paperSize: PaperSize) => void db.settings.update('settings', { paperSize });
  const [month, setMonth] = useState(currentMonth());
  const summary = useMemo(() => buildMonthSummary(month, data), [month, data]);
  const reports = useMemo(() => buildAllReports(summary, data.settings), [summary, data.settings]);
  const [active, setActive] = useState(0);
  const [fit, setFit] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const previewBox = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [stageHeights, setStageHeights] = useState<number[]>([]);

  useLayoutEffect(() => {
    setStageHeights(stageRefs.current.map((el) => el?.offsetHeight ?? 0));
  }, [reports]);

  useEffect(() => {
    const el = previewBox.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const today = todayIso();
  const unrecorded = summary.rows.filter((r) => r.status.kind === 'unrecorded' && r.date <= today);
  const drafts = summary.rows.filter((r) => r.served && !r.submitted);
  const prefix = `AWC_${data.settings.center.number}_${monthShort(month)}`;

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    try {
      await task();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const excel = (models: SheetModel[], fileName: string) =>
    run(fileName, async () => downloadBlob(await workbookBlob(models, paper), `${fileName}_${paper}.xlsx`));

  const pdf = (indices: number[], fileName: string) =>
    run(fileName, async () => {
      await document.fonts.ready;
      const pages = indices.map((i) => ({ model: reports[i], element: stageRefs.current[i]! }));
      downloadBlob(await sheetsToPdf(pages, paper), `${fileName}_${paper}.pdf`);
    });

  const current = reports[active];
  const zoom = fit && boxWidth ? Math.min(1, boxWidth / sheetWidthPx(current)) : 1;

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <MonthSwitcher month={month} onChange={setMonth} />
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('cookingDays')} value={summary.servedDays} tone="teal" />
          <Stat label={t('beneficiaryDays')} value={summary.beneficiaryDays} />
          <Stat label={t('vegEggCost')} value={rupees(summary.purchaseTotal)} tone="amber" />
        </div>

        {unrecorded.length > 0 && (
          <div className="flex gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <AlertTriangle size={20} className="shrink-0" />
            <div>
              <div className="font-semibold">
                {t('unrecordedWarning')}: {unrecorded.length}
              </div>
              <div className="text-amber-800">{unrecorded.map((r) => r.day).join(', ')}</div>
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
              <div className="text-red-800">{drafts.map((r) => r.day).join(', ')}</div>
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
          <p className="mb-3 text-xs text-slate-500">{t('paperHint')}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="primary" disabled={busy !== null} onClick={() => void excel(reports, `${prefix}_ICDS_Reports`)}>
              <FileSpreadsheet size={18} /> {t('downloadAllExcel')}
            </Button>
            <Button variant="primary" disabled={busy !== null} onClick={() => void pdf([0, 1, 2, 3], `${prefix}_ICDS_Reports`)}>
              <FileDown size={18} /> {t('downloadAllPdf')}
            </Button>
            <Button disabled={busy !== null} onClick={() => window.print()}>
              <Printer size={18} /> {t('print')}
            </Button>
          </div>
          {busy && <p className="mt-2 text-sm text-slate-500">{t('preparing')}</p>}
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
          title={current.title}
          actions={
            <div className="flex gap-1">
              <Button variant="ghost" className="px-2" onClick={() => setFit(!fit)} aria-label={t('fitWidth')} title={t('fitWidth')}>
                <Maximize2 size={18} />
              </Button>
              <Button disabled={busy !== null} onClick={() => void excel([current], current.fileName)}>
                <FileSpreadsheet size={16} /> {t('excel')}
              </Button>
              <Button disabled={busy !== null} onClick={() => void pdf([active], current.fileName)}>
                <FileDown size={16} /> {t('pdf')}
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
      </div>

      {createPortal(
        <div className="export-stage" aria-hidden>
          {reports.map((r, i) => {
          return (
            <div
              key={r.id}
              className={`print-page print-${paper.toLowerCase()}-${r.landscape ? 'landscape' : 'portrait'}`}
              style={{ ['--print-zoom' as string]: printZoom(r, stageHeights[i] ?? 0, paper) }}
            >
                <SheetPreview
                  model={r}
                  ref={(el) => {
                    stageRefs.current[i] = el;
                  }}
                />
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
