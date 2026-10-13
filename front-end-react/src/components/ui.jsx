/**
 * components/ui.jsx - The shared UI kit.
 *
 * Every page re-uses these small building blocks so pages stay short:
 *   Button, Card, Badge, Avatar, Modal, Input/Select/Textarea + Field,
 *   Table, Pagination, StatCard, PageHeader, EmptyState, Loading, ErrorBanner,
 *   FilterDropdown, Tabs.
 *
 * All styling is Tailwind utility classes - there is no CSS file here.
 */

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/* ───────────────────────────────  BUTTON  ─────────────────────────────── */

/** One button component with 5 colour styles (called "variants"). */
export function Button({ variant = 'primary', loading = false, className = '', children, ...rest }) {
  // disabled while `loading` so users can't double-click
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-light',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    gold: 'bg-gold text-brand hover:brightness-95',
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
        transition disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Spinner size={14} light />} {/* tiny spinner inside the button */}
      {children}
    </button>
  );
}

/* ────────────────────────────────  CARD  ──────────────────────────────── */

/** White rounded box used for every panel on the page.
    Any extra props (onClick, style...) land on the underlying div. */
export function Card({ className = '', children, ...rest }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`} {...rest}>{children}</div>;
}

/* ───────────────────────────────  BADGES  ─────────────────────────────── */

/** Small coloured pill. variant picks the colour scheme. */
export function Badge({ variant = 'slate', className = '', children }) {
  const styles = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-700',
    purple: 'bg-purple-50 text-purple-700',
    navy: 'bg-brand text-white',
  }[variant];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles} ${className}`}>
      {children}
    </span>
  );
}

/** Maps any status word (PAID, Ongoing, IN PROGRESS...) to a Badge colour.
    Used by tables on almost every page. */
export function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase();
  const variant =
    ['paid', 'completed', 'active', 'confirmed', 'available', 'verified', 'success', 'scheduled'].includes(s)
      ? 'green'
      : ['pending', 'ongoing', 'in progress', 'in_progress', 'reviewing', 'processing'].includes(s)
      ? 'amber'
      : ['overdue', 'cancelled', 'canceled', 'closed', 'failed', 'busy', 'inactive'].includes(s)
      ? 'red'
      : 'blue';
  return <Badge variant={variant}>{status}</Badge>;
}

/* ───────────────────────────────  AVATAR  ─────────────────────────────── */

/** Circle with the person's initials (same look as the vanilla app). */
export function Avatar({ name = '?', className = 'h-9 w-9' }) {
  const letters = (name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 ${className}`}>
      {letters}
    </div>
  );
}

/* ────────────────────────────────  MODAL  ─────────────────────────────── */

/** Centered dialog with a dark overlay.
    Props: open (bool), onClose (fn), title, wide (bool), children, footer. */
export function Modal({ open, onClose, title, subtitle, wide = false, children, footer }) {
  // Pressing Escape closes the modal too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock page scroll while a modal is open (same as vanilla overflow:hidden).
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null; // render nothing when closed

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose?.()} /* click outside = close */
    >
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        {/* header */}
        {(title || onClose) && (
          <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
            <div>
              {title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
            {onClose && (
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <Icon name="x" />
              </button>
            )}
          </div>
        )}
        {/* body (scrollable) */}
        <div className="thin-scroll flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {/* optional footer row of buttons */}
        {footer && <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────  FORM FIELDS  ──────────────────────────── */

/** Wrapper that draws a label + red error message under any input. */
export function Field({ label, error, required = false, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      )}
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

/** Shared classes so inputs, selects and textareas look identical. */
const inputCls = (error) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none transition
   placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20
   ${error ? 'border-red-400 bg-red-50' : 'border-slate-300'}`;

export function Input({ error = null, className = '', ...rest }) {
  return <input className={`${inputCls(error)} ${className}`} {...rest} />;
}

export function Select({ error = null, className = '', children, ...rest }) {
  return <select className={`${inputCls(error)} ${className}`} {...rest}>{children}</select>;
}

export function Textarea({ error = null, className = '', ...rest }) {
  return <textarea className={`${inputCls(error)} ${className}`} {...rest} />;
}

/* ────────────────────────────────  TABLE  ─────────────────────────────── */

/** A consistently-styled table. Children are <thead>/<tbody> written per page. */
export function Table({ children, fit = false }) {
  return (
    <div className="thin-scroll overflow-x-auto">
      <table className={`w-full text-left text-sm ${fit ? '' : 'min-w-[640px]'}`}>{children}</table>
    </div>
  );
}

/** Header cell styling, used inside <thead>. */
export function Th({ children, className = '' }) {
  return <th className={`border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 ${className}`}>{children}</th>;
}

/** Body cell styling, used inside <tbody>. colSpan lets empty-state
    messages stretch across the whole table. */
export function Td({ children, className = '', colSpan }) {
  return <td colSpan={colSpan} className={`border-b border-slate-50 px-4 py-3 align-middle text-slate-700 ${className}`}>{children}</td>;
}

/* ──────────────────────────────  FEEDBACK  ────────────────────────────── */

/** Green spinner shown while data loads. */
export function Spinner({ size = 36, light = false }) {
  return (
    <span
      className="inline-block animate-spin rounded-full"
      style={{
        width: size, height: size,
        borderWidth: size / 9,
        borderStyle: 'solid',
        borderColor: light ? 'rgba(255,255,255,.35)' : '#e5e7eb',
        borderTopColor: light ? '#fff' : '#4f46e5',
      }}
    />
  );
}

/** Centered spinner with a caption - used as the "loading a page" state. */
export function Loading({ text = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-50 py-14">
      <Spinner />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

/** Red banner when an API call fails. retry re-runs the fetch when provided. */
export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      <span className="flex items-center gap-2"><Icon name="alert" size={16} /> {message}</span>
      {onRetry && <Button variant="outline" className="!py-1.5" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

/** Grey box shown when a list has nothing to display (dashed border like vanilla). */
export function EmptyState({ icon = 'info', title, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <Icon name={icon} size={40} className="text-slate-300" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {action}
    </div>
  );
}

/* ────────────────────────────  PAGE HEADER  ───────────────────────────── */

/** The big title row at the top of every page. actions = buttons on the right. */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

/** The 4 small "number cards" used on dashboards (total billed, pending...). */
export function StatCard({ label, value, hint, icon, tone = 'indigo' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-600',
  }[tone];
  return (
    <Card className="h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* min-h keeps room for 2 lines so every card's number sits at the same height */}
          <p className="min-h-8 text-xs font-semibold uppercase leading-4 tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
        </div>
        {icon && <div className={`rounded-xl p-3 ${tones}`}><Icon name={icon} size={20} /></div>}
      </div>
    </Card>
  );
}

/* ─────────────────────────────  PAGINATION  ───────────────────────────── */

/** "Showing X–Y of Z" + numbered page buttons (client-side pagination).
    perPage = how many rows each page shows, so the label is correct. */
export function Pagination({ page, pages, total, perPage = 5, onPage }) {
  if (total === 0) return null; // nothing to paginate
  const nums = Array.from({ length: pages }, (_, i) => i + 1); // [1,2,3...]
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-slate-600">
      <span>
        Showing <b>{(page - 1) * perPage + 1}</b>–<b>{Math.min(page * perPage, total)}</b> of <b>{total}</b>
      </span>
      <div className="flex items-center gap-1">
        <PagerBtn disabled={page === 1} onClick={() => onPage(page - 1)}><Icon name="chevronLeft" size={14} /></PagerBtn>
        {nums.map((n) => (
          <button
            key={n}
            onClick={() => onPage(n)}
            className={`h-8 min-w-8 rounded-lg px-2 text-sm font-medium ${
              n === page ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {n}
          </button>
        ))}
        <PagerBtn disabled={page === pages} onClick={() => onPage(page + 1)}><Icon name="chevronRight" size={14} /></PagerBtn>
      </div>
    </div>
  );
}
function PagerBtn({ disabled, onClick, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40">
      {children}
    </button>
  );
}

/* ─────────────────────────────  FILTER POPOVER  ───────────────────────── */

/** Small dropdown panel anchored to a "Filters" button (used on case/task lists). */
export function FilterDropdown({ label = 'Filters', children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Click anywhere outside the dropdown -> close it.
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={() => setOpen(!open)}>
        <Icon name="filter" size={14} /> {label} <Icon name="chevronDown" size={14} />
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────  TABS  ──────────────────────────────── */

/** Row of tab buttons (e.g. "All Cases" / "Pending Tasks"). */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition
            ${active === t.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t.label}
          {t.badge !== undefined && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
