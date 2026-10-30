import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { currentMonth, monthLabel, monthName, shiftMonth } from '../domain/dates';
import { useApp } from '../state/AppDataContext';
import { Button, Modal } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');

/** Previous / next month arrows, and the month name opens a picker (no native month input: iOS anchors it off-screen). */
export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const { lang, t } = useApp();
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" className="shrink-0 px-2" onClick={() => onChange(shiftMonth(month, -1))} aria-label={t('previousMonth')}>
        <ChevronLeft />
      </Button>
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-lg font-bold text-slate-900 hover:bg-slate-200/60 active:bg-slate-200"
        aria-label={t('chooseMonth')}
      >
        <span className="truncate">{monthLabel(month, lang)}</span>
        <ChevronDown size={18} className="shrink-0 text-slate-400" />
      </button>
      <Button variant="ghost" className="shrink-0 px-2" onClick={() => onChange(shiftMonth(month, 1))} aria-label={t('nextMonth')}>
        <ChevronRight />
      </Button>
      {picking && (
        <MonthPicker
          month={month}
          onClose={() => setPicking(false)}
          onPick={(m) => {
            setPicking(false);
            onChange(m);
          }}
        />
      )}
    </div>
  );
}

function MonthPicker({ month, onClose, onPick }: { month: string; onClose: () => void; onPick: (m: string) => void }) {
  const { lang, t } = useApp();
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const today = currentMonth();
  return (
    <Modal open onClose={onClose} title={t('chooseMonth')}>
      <div className="mb-3 flex items-center justify-between rounded-xl bg-white p-1 ring-1 ring-slate-200">
        <Button variant="ghost" className="px-2" onClick={() => setYear(year - 1)} aria-label={t('previousYear')}>
          <ChevronLeft />
        </Button>
        <span className="text-lg font-bold tabular-nums text-slate-900">{year}</span>
        <Button variant="ghost" className="px-2" onClick={() => setYear(year + 1)} aria-label={t('nextYear')}>
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }, (_, i) => {
          const value = `${year}-${pad(i + 1)}`;
          const selected = value === month;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onPick(value)}
              aria-pressed={selected}
              className={`rounded-xl px-2 py-3 text-sm font-semibold transition ${
                selected
                  ? 'bg-teal-700 text-white shadow-sm'
                  : `bg-white text-slate-800 ring-1 hover:bg-slate-50 ${value === today ? 'ring-2 ring-teal-500' : 'ring-slate-200'}`
              }`}
            >
              {monthName(i + 1, lang)}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
