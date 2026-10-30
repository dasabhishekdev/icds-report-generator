import {
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 active:bg-teal-900 shadow-sm',
  secondary: 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-700 hover:bg-slate-100 active:bg-slate-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
};

const BUTTON_BASE =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${BUTTON_BASE} ${VARIANT[variant]} ${className}`} {...props} />;
}

/** A link styled as a button — for downloads and opening files. */
export function ButtonLink({
  variant = 'secondary',
  className = '',
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return <a className={`${BUTTON_BASE} ${VARIANT[variant]} ${className}`} {...props} />;
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border-0 bg-white px-3 py-2.5 text-base text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-600 focus:outline-none';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

/** Number input that keeps the user's text while typing and reports parsed numbers. */
export function NumberInput({
  value,
  onChange,
  placeholder,
  className = '',
  step = 'any',
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  className?: string;
  step?: string;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => {
    const parsed = text === '' ? undefined : Number(text);
    if (parsed !== value) setText(value === undefined ? '' : String(value));
  }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const v = e.target.value === '' ? undefined : Number(e.target.value);
        if (v === undefined || !Number.isNaN(v)) onChange(v);
      }}
      className={`${inputClass} ${className}`}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  disabled = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: 'md' | 'lg';
  disabled?: boolean;
}) {
  return (
    <div className={`flex rounded-xl bg-slate-100 p-1 ${disabled ? 'opacity-60' : ''}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 font-semibold transition ${size === 'lg' ? 'py-3 text-base' : 'py-2 text-sm'} ${
            o.value === value ? 'bg-white text-teal-800 shadow ring-1 ring-slate-200' : 'text-slate-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 text-left ${disabled ? 'opacity-60' : ''}`}
    >
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-teal-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
      <span className="text-sm font-medium text-slate-800">{label}</span>
    </button>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 md:items-center" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-slate-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl md:max-w-xl md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-200" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, tone = 'slate' }: { label: ReactNode; value: ReactNode; tone?: 'slate' | 'teal' | 'amber' | 'rose' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-900',
    teal: 'bg-teal-50 text-teal-900',
    amber: 'bg-amber-50 text-amber-900',
    rose: 'bg-rose-50 text-rose-900',
  };
  return (
    <div className={`rounded-xl px-3 py-2 ${tones[tone]}`}>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function useFlash(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 1800);
    return () => clearTimeout(id);
  }, [msg]);
  return [msg, setMsg];
}

export function Flash({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center md:bottom-8">
      <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">{message}</div>
    </div>
  );
}
