/**
 * Chart.jsx - the stacked bar chart shared by the two superadmin
 * revenue pages (SADashboard + SARevenue).
 *
 * No chart library: each month is a flex column whose two inner divs
 * (subscriptions + commission) are sized with simple percentage heights.
 */

import { moneyShort } from '../../lib/format.js';

export function RevenueChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No earnings recorded yet.</p>;
  }

  // The tallest month defines the 100% height reference.
  const peak = Math.max(...data.map((m) => Number(m.total || 0)), 1);

  return (
    <div className="flex items-end gap-4 overflow-x-auto pb-2" style={{ height: 240 }}>
      {data.map((m) => {
        const total = Number(m.total || 0);
        const subPct = total > 0 ? (Number(m.subscription || 0) / total) * 100 : 100;
        const height = Math.max((total / peak) * 100, 2); // min 2% so empty months stay visible
        // "Apr 2026" -> "Apr '26"
        const short = String(m.label || '').replace(' ', " '").replace(/(\d{2})(\d{2})/, '$2');
        return (
          <div key={m.label} className="flex min-w-[64px] flex-1 flex-col items-center justify-end gap-1"
            title={`${m.label}\nSubscriptions: ₹${Number(m.subscription || 0).toLocaleString('en-IN')}\nCommission: ₹${Number(m.commission || 0).toLocaleString('en-IN')}\nTotal: ₹${total.toLocaleString('en-IN')}`}>
            <span className="text-[10px] font-bold text-slate-600">{moneyShort(total)}</span>
            {/* the stacked bar itself */}
            <div className="flex w-10 flex-col justify-end overflow-hidden rounded-t-lg" style={{ height: `${height}%` }}>
              <div className="bg-gold" style={{ height: `${100 - subPct}%` }} />
              <div className="bg-indigo-600" style={{ height: `${subPct}%` }} />
            </div>
            <span className="whitespace-nowrap text-[10px] text-slate-400">{short}</span>
          </div>
        );
      })}
    </div>
  );
}