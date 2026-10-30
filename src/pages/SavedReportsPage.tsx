import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, Cloud, FileDown, FileSpreadsheet, HardDrive, Loader2, Printer, Trash2 } from 'lucide-react';
import { reportError } from '../api/http';
import { reportsApi, type StoredReport } from '../api/reports';
import { currentMonth, monthLabel } from '../domain/dates';
import { REPORT_IDS, REPORT_TITLES } from '../reports';
import { periodText, rupees } from '../lib/format';
import { useApp } from '../state/AppDataContext';
import { Button, ButtonLink, Card, Segmented } from '../components/ui';
import { MonthSwitcher } from '../components/MonthSwitcher';

type Scope = 'all' | 'month';

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Every generated report of the signed-in user, stored month-wise (S3 or the server volume). */
export function SavedReportsPage() {
  const { t, lang } = useApp();
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? currentMonth();
  const scope: Scope = params.has('month') ? 'month' : 'all';
  const highlight = params.get('highlight');
  const [reports, setReports] = useState<StoredReport[] | null>(null);

  const setFilter = (next: { scope: Scope; month?: string }) => {
    const p = new URLSearchParams();
    if (next.scope === 'month') p.set('month', next.month ?? month);
    setParams(p, { replace: true });
  };

  const refresh = useCallback(async () => {
    try {
      setReports(await reportsApi.list(scope === 'month' ? month : undefined));
    } catch (e) {
      reportError(e);
      setReports([]);
    }
  }, [scope, month]);

  useEffect(() => {
    setReports(null);
    void refresh();
  }, [refresh]);

  async function remove(r: StoredReport) {
    if (!confirm(t('deleteReportConfirm'))) return;
    try {
      await reportsApi.remove(r.id);
      await refresh();
    } catch (e) {
      reportError(e);
    }
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'bn' ? 'bn-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const groups = (reports ?? []).reduce<{ month: string; items: StoredReport[] }[]>((acc, r) => {
    const last = acc[acc.length - 1];
    if (last?.month === r.month) last.items.push(r);
    else acc.push({ month: r.month, items: [r] });
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/reports" className="rounded-xl p-2 text-slate-600 hover:bg-slate-200" aria-label={t('backToReports')}>
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl">{t('savedReports')}</h1>
        {reports && <span className="text-slate-400">({reports.length})</span>}
      </div>

      <Card>
        <Segmented
          value={scope}
          onChange={(s) => setFilter({ scope: s })}
          options={[
            { value: 'all', label: t('allMonths') },
            { value: 'month', label: t('oneMonth') },
          ]}
        />
        {scope === 'month' && (
          <div className="mt-3">
            <MonthSwitcher month={month} onChange={(m) => setFilter({ scope: 'month', month: m })} />
          </div>
        )}
      </Card>

      {reports === null ? (
        <div className="flex items-center gap-2 px-1 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> {t('preparing')}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">{t('noSavedReports')}</p>
          <Link to="/reports" className="mt-3 inline-flex">
            <Button variant="primary">{t('generateReports')}</Button>
          </Link>
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.month} title={`${monthLabel(g.month, lang)} · ${g.items.length}`}>
            <ul className="space-y-2">
              {g.items.map((r) => {
                const pdf = r.files.find((f) => f.kind === 'pdf');
                return (
                  <li
                    key={r.id}
                    className={`rounded-xl p-3 ring-1 ${r.id === highlight ? 'bg-teal-50 ring-teal-300' : 'bg-slate-50 ring-slate-200'}`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-bold text-slate-900">{periodText(r, lang)}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{r.paper}</span>
                      <span className="text-xs text-slate-500">{when(r.createdAt)}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        {r.storage === 's3' ? <Cloud size={14} /> : <HardDrive size={14} />}
                        {r.storage === 's3' ? 'S3' : t('storedOnServer')}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {r.sheets.length === REPORT_IDS.length ? t('allFourRegisters') : r.sheets.map((id) => REPORT_TITLES[id]).join(', ')} ·{' '}
                      {t('cookingDays')}: {r.summary.servedDays} · {t('vegEggCost')}: {rupees(r.summary.purchaseTotal)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ButtonLink variant="primary" href={reportsApi.fileUrl(r.id, 'pdf')} download>
                        <FileDown size={16} /> PDF{pdf ? ` (${kb(pdf.size)})` : ''}
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
                );
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
