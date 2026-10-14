/**
 * Superadmin - Revenue page: full earnings breakdown, month-range chart,
 * plan mix, earnings by firm, and the subscription-charges table.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { Card, Badge, StatusBadge, Loading, ErrorBanner, Table, Th, Td, Select, StatCard } from '../../components/ui.jsx';
import { money, moneyShort, initials } from '../../lib/format.js';
import { RevenueChart } from './Chart.jsx';

export default function SARevenue() {
  const { toast } = useApp();

  const [summary, setSummary] = useState(null);
  const [byFirm, setByFirm] = useState([]);
  const [charges, setCharges] = useState([]);
  const [months, setMonths] = useState([]);
  const [range, setRange] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Refresh every dataset (called again after charge toggles). */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, f, c] = await Promise.all([
        api.platform.getRevenueSummary('superadmin'),
        api.platform.getRevenueByFirm('superadmin').catch(() => []),
        api.platform.getCharges('superadmin').catch(() => []),
      ]);
      setSummary(s);
      setByFirm(Array.isArray(f) ? f : []);
      setCharges(Array.isArray(c) ? c : []);
      await drawChart(range);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  /* Re-fetch only the chart when the month range changes. */
  const drawChart = async (n) => {
    try {
      const m = await api.platform.getMonthlyRevenue(n, 'superadmin');
      setMonths(Array.isArray(m) ? m : []);
    } catch {
      setMonths([]);
      toast('Could not load the chart data.', 'error');
    }
  };

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading text="Loading revenue…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  const sub = summary?.subscriptionRevenue || {};
  const com = summary?.commissionRevenue || {};

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Revenue</h1>
      <p className="mb-6 text-sm text-slate-500">Every rupee LexFlow earns, broken down.</p>

      {/* ── KPI row ── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total earned" value={money(summary?.totalEarnings, 0)} icon="dollar" />
        <StatCard label="From subscriptions" value={money(sub.collected, 0)} icon="calendar" tone="blue" />
        <StatCard label="From commission" value={money(com.collected, 0)} icon="percent" tone="green" />
        <StatCard label="Outstanding" value={money(sub.outstanding, 0)} hint="Billed, not yet collected" icon="alert" tone="amber" />
      </div>

      {/* ── Chart with range selector ── */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Earnings by month</h2>
            <p className="text-xs text-slate-400">MRR {money(summary?.mrr, 0)} · annualised {money(summary?.arr, 0)}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-3 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-indigo-600" /> Subscriptions</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-gold" /> Commission</span>
            </div>
            <Select value={range} onChange={(e) => setRange(Number(e.target.value))} className="!w-32">
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
            </Select>
          </div>
        </div>
        <RevenueChart data={months} />
      </Card>

      {/* ── Plan mix ── */}
      <Card className="mb-6">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">Plan mix</h2>
          <a href="#/superadmin/settings" className="text-sm font-semibold text-indigo-600 hover:underline">Edit pricing →</a>
        </div>
        <Table>
          <thead><tr><Th>Tier</Th><Th>Firms</Th><Th>Price / month</Th><Th>MRR</Th></tr></thead>
          <tbody>
            {(summary?.byTier || []).map((t) => (
              <tr key={t.tier} className="hover:bg-slate-50">
                <Td><Badge variant="blue">{t.tier}</Badge></Td>
                <Td>{t.firms}</Td>
                <Td>{money(t.monthlyPrice, 0)}</Td>
                <Td className="font-bold">{money(t.mrr, 0)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* ── Earnings by firm ── */}
      <Card className="mb-6">
        <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Earnings by firm</h2></div>
        <Table>
          <thead>
            <tr><Th>Firm</Th><Th>Tier</Th><Th>Status</Th><Th>Price / mo</Th><Th>Subscriptions</Th><Th>Commission</Th><Th>Outstanding</Th><Th>Total earned</Th></tr>
          </thead>
          <tbody>
            {byFirm.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No firm earnings recorded yet.</td></tr>
            ) : byFirm.map((f, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <Td>
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{initials(f.firmName)}</span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{f.firmName}</span>
                      <span className="block text-[10px] text-slate-400">{f.firmId} · {f.months || '?'} month(s)</span>
                    </span>
                  </span>
                </Td>
                <Td><Badge variant="blue">{f.tier}</Badge></Td>
                <Td><StatusBadge status={String(f.status || '').replace('_', ' ')} /></Td>
                <Td>{money(f.monthlyPrice, 0)}</Td>
                <Td>{money(f.subscriptionCollected, 0)}</Td>
                <Td>{money(f.commission, 0)}</Td>
                <Td>{money(f.subscriptionOutstanding, 0)}</Td>
                <Td className="font-bold">{money(f.totalEarned, 0)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {/* unattributed commission note (commissions without a linked firm) */}
        {com.unattributed > 0 && (
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-amber-600">
            {money(com.unattributed)} of commission comes from invoices whose client is not linked to a firm.
          </p>
        )}
      </Card>

      {/* ── Subscription charges ── */}
      <Card>
        <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Subscription charges</h2></div>
        <Table>
          <thead><tr><Th>Charge</Th><Th>Firm</Th><Th>Tier</Th><Th>Period</Th><Th>Amount</Th><Th>Status</Th></tr></thead>
          <tbody>
            {charges.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No charges recorded.</td></tr>
            ) : charges.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <Td className="font-mono text-xs font-bold">{c.id}</Td>
                <Td>{c.firmName || c.firmId}</Td>
                <Td><Badge variant="blue">{c.tier}</Badge></Td>
                <Td className="text-xs">{c.period}</Td>
                <Td className="font-semibold">{money(c.amount, 0)}</Td>
                <Td><StatusBadge status={c.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}