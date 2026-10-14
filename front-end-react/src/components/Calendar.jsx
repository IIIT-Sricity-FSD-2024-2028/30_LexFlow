/**
 * components/Calendar.jsx - Small month calendar used in the
 * "Book Consultation" modal (pick a date).
 *
 * Props:
 *   selected  - Date that should look highlighted (optional)
 *   onPick    - called with the clicked Date (optional; omit for browse-only)
 *   disablePast - grey out days before today (used by the booking modal)
 */

import { useState } from 'react';
import Icon from './Icon.jsx';

export default function Calendar({ selected, onPick, disablePast = false, dots = {} }) {
  /* Which month is on display? Start at the month of `selected` or today. */
  const [view, setView] = useState(() => {
    const start = selected || new Date();
    return { year: start.getFullYear(), month: start.getMonth() }; // month: 0-11
  });

  const today = new Date();

  /* Go to the previous / next month (with year rollover). */
  const shift = (delta) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  /* Build the 6x7 grid of day cells for the viewed month. */
  const buildDays = () => {
    const first = new Date(view.year, view.month, 1);     // first of this month
    const startDow = first.getDay();                      // 0 = Sunday
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const cells = [];

    // Leading days from the previous month (muted, not clickable).
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(view.year, view.month, -i);
      cells.push({ date: d, muted: true });
    }
    // Every day of the current month.
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: new Date(view.year, view.month, day), muted: false });
    }
    // Trailing days from the next month until the grid is complete (42 cells).
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: new Date(last.getTime() + 86400000), muted: true });
    }
    return cells;
  };

  /* Same day check (ignores the time part). */
  const sameDay = (a, b) =>
    a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const monthLabel = new Date(view.year, view.month, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      {/* Month header with prev/next arrows */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">{monthLabel}</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><Icon name="chevronLeft" size={14} /></button>
          <button type="button" onClick={() => shift(1)} aria-label="Next month"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><Icon name="chevronRight" size={14} /></button>
        </div>
      </div>

      {/* Weekday letters row */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>

      {/* The day cells */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {buildDays().map(({ date, muted }, i) => {
          const isSelected = sameDay(date, selected);
          const isPast = disablePast && date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const dot = dots[date.toDateString()]; // optional coloured dot (schedule page)
          return (
            <button
              key={i}
              type="button"
              disabled={muted || isPast || !onPick}
              onClick={() => onPick?.(date)}
              className={`relative flex h-8 items-center justify-center rounded-lg text-xs
                ${muted ? 'text-slate-300' : 'text-slate-700'}
                ${isSelected ? 'bg-brand font-bold text-white' : 'hover:bg-slate-100'}
                ${isPast ? 'cursor-not-allowed opacity-35' : ''}`}
            >
              {date.getDate()}
              {dot && <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${dot}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}