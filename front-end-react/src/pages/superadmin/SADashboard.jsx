/**
 * Superadmin - Platform Overview dashboard.
 * Hero earnings card, KPI grid, 6-month stacked bar chart and the
 * top-earning firms table. Replaces superadmin-dashboard.html + the
 * initDashboard part of superadmin.js.
 */

import { useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { Card, Badge, Loading, ErrorBanner, Table, Th, Td, StatCard } from '../../components/ui.jsx';
import { money, moneyShort, initials, formatDate } from '../../lib/format.js';
import { RevenueChart } from './Chart.jsx';

export default function SADashboard() {
  const [data, setData] = useState({});
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Each dataset loads independently so one failure never blanks the page.
        const [summary, months, firms, lawyers, users, byFirm] = await Promise.all([
          api.platform.getRevenueSummary('superadmin').catch(() => null),
          api.platform.getMonthlyRevenue(6, 'superadmin').catch(() => []),
          api.users.getAllFirms('superadmin').catch(() => []),
          api.users.getLawyers(null, 'superadmin').catch(() => []),
          api.users.getAll({}, 'superadmin').catch(() => []),
          api.platform.getRevenueByFirm('superadmin').catch(() => []),
        ]);
        setData({ summary, firms, lawyers, users, byFirm });
        setMonthly(Array.isArray(months) ? months : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading text="Loading platform overview…" />;
  if (error) return <ErrorBanner message={error} />;

  const s = data.summary || {};
  const growth = s.growthPct;
  const delta = growth == null ? 'No prior month'
    : growth > 0 ? `▲ ${growth}% vs last month`
    : growth < 0 ? `▼ ${Math.abs(growth)}% vs last month`
    : '■ flat vs last month';

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Platform Overview</h1>
      <p className="mb-6 text-sm text-slate-500">What LexFlow earns from the law firms running on it.</p>

      {/* ── Hero earnings card ── */}
      <Card className="mb-6 bg-brand p-6 text-black">
        <p className="text-xs font-bold uppercase tracking-widest text-black/60">Total earnings to date</p>
        <p className="mt-1 text-4xl font-extrabold">{money(s.totalEarnings, 0)}</p>
        <p className="mt-1 text-sm text-black/70">
          {s.activeSubscriptions || 0} active subscription(s) · {moneyShort(s.mrr || 0)} MRR
        </p>
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-black/10 pt-4 text-sm">
          <div><p className="text-black/60">Subscriptions</p><p className="text-lg font-bold">{money(s.subscriptionRevenue?.collected, 0)}</p></div>
          <div><p className="text-black/60">Commission</p><p className="text-lg font-bold">{money(s.commissionRevenue?.collected, 0)}</p></div>
          <div><p className="text-black/60">Outstanding</p><p className="text-lg font-bold">{money(s.subscriptionRevenue?.outstanding, 0)}</p></div>
        </div>
      </Card>

      {/* ── KPI grid ── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" value={money(s.mrr, 0)} hint={`${moneyShort(s.arr || 0)} annualised`} icon="dollar" />
        <StatCard label="Billed this month" value={money(s.thisMonth?.total, 0)}
          hint={delta} icon="activity" tone="blue" />
        <StatCard label="Commission earned" value={money(s.commissionRevenue?.collected, 0)}
          hint={`${s.commissionRevenue?.rate ?? 10}% of ${moneyShort(s.commissionRevenue?.billedThroughPlatform || 0)}`} icon="percent" tone="green" />
        <StatCard label="Law firms" value={data.firms?.length ?? 0} hint="Paying subscribers" icon="building" tone="amber" />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Lawyers & interns" value={data.lawyers?.length ?? 0} icon="user" tone="blue" />
        <StatCard label="Total users" value={data.users?.length ?? 0} icon="users" tone="indigo" />
      </div>

      {/* ── Chart ── */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between">
          <h2 className="font-bold text-slate-900">Earnings over the last 6 months</h2>
          <div className="flex gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-brand" /> Subscriptions</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-gold" /> Commission</span>
          </div>
        </div>
        <RevenueChart data={monthly} />
      </Card>

      {/* ── Top earning firms ── */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">Top earning firms</h2>
          <a href="#/superadmin/revenue" className="text-sm font-semibold text-indigo-600 hover:underline">See all →</a>
        </div>
        <Table>
          <thead>
            <tr><Th>Firm</Th><Th>Tier</Th><Th>Subscriptions</Th><Th>Commission</Th><Th>Total earned</Th></tr>
          </thead>
          <tbody>
            {(data.byFirm || []).slice(0, 5).map((f, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <Td>
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{initials(f.firmName)}</span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{f.firmName}</span>
                      <span className="block text-[10px] text-slate-400">Since {formatDate(f.since)}</span>
                    </span>
                  </span>
                </Td>
                <Td><Badge variant="blue">{f.tier}</Badge></Td>
                <Td>{money(f.subscriptionCollected, 0)}</Td>
                <Td>{money(f.commission, 0)}</Td>
                <Td className="font-bold">{money(f.totalEarned, 0)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}