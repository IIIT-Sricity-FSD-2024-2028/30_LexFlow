/**
 * Superadmin - Invoices: what firms bill their clients, plus the
 * platform's commission cut (computed client-side from the settings rate).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import {
  Button, Card, Badge, PageHeader, Loading, ErrorBanner, StatCard, Table, Th, Td, Input, Select,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { money, formatDate } from '../../lib/format.js';

export default function SAInvoices() {
  const { toast } = useApp();

  const [invoices, setInvoices] = useState([]);
  const [rate, setRate] = useState(10); // commission % (from settings, default 10)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [inv, settings] = await Promise.all([
        api.billing.getInvoices('superadmin').catch(() => []),
        api.platform.getSettings('superadmin').catch(() => null),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      if (settings?.commissionRate != null) setRate(settings.commissionRate);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((inv) => {
      const okSearch = !q || `${inv.id} ${inv.clientName} ${inv.caseName} ${inv.advocateName}`.toLowerCase().includes(q);
      const okStatus = statusFilter === 'all' || inv.status === statusFilter;
      return okSearch && okStatus;
    });
  }, [invoices, search, statusFilter]);

  /* KPIs use the FILTERED list (same as vanilla). */
  const gross = filtered.filter((i) => i.status === 'Paid').reduce((s, i) => s + Number(i.amount || 0), 0);
  const commission = (gross * rate) / 100;

  const markPaid = async (inv) => {
    try {
      await api.billing.updateInvoice(inv.id, { status: 'Paid' }, 'superadmin');
      toast('Invoice marked paid — commission recorded.');
      load();
    } catch (err) {
      toast(err.message || 'Update failed', 'error');
    }
  };

  const remove = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.id}?`)) return;
    try {
      await api.billing.deleteInvoice(inv.id, 'superadmin');
      toast('Invoice deleted.');
      load();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  };

  if (loading) return <Loading text="Loading invoices…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <>
      <PageHeader title="Client Invoices" subtitle="What firms bill their clients — and your commission on it." />

      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Paid through the platform" value={money(gross, 0)} hint="Settled client invoices" icon="dollar" tone="green" />
        <StatCard label="Your commission" value={money(commission, 0)} hint={`at ${rate}% commission`} icon="percent" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search invoice, client, case or advocate…" value={search} onChange={(e) => setSearch(e.target.value)} className="!w-80" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-36">
          {['all', 'Paid', 'Pending', 'Overdue'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </Select>
        <span className="text-xs font-semibold text-slate-400">{filtered.length} of {invoices.length}</span>
      </div>

      <Card>
        <Table>
          <thead>
            <tr><Th>Invoice</Th><Th>Client / Case</Th><Th>Advocate</Th><Th>Amount</Th><Th>Your cut</Th><Th>Due</Th><Th>Status</Th><Th>Actions</Th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No invoices match your filters.</td></tr>
            ) : filtered.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <Td className="font-mono text-xs font-bold">{inv.id}</Td>
                <Td>
                  <span className="block text-sm font-semibold text-slate-800">{inv.clientName || '—'}</span>
                  <span className="block text-[10px] text-slate-400">{inv.caseName}</span>
                </Td>
                <Td>{inv.advocateName || '—'}</Td>
                <Td>{money(inv.amount)}</Td>
                {/* commission only counts once the invoice is actually Paid */}
                <Td className="font-semibold text-emerald-600">
                  {inv.status === 'Paid' ? money((Number(inv.amount) * rate) / 100) : '—'}
                </Td>
                <Td className="text-xs">{formatDate(inv.dueDate)}</Td>
                <Td><Badge variant={inv.status === 'Paid' ? 'green' : inv.status === 'Overdue' ? 'red' : 'amber'}>{inv.status}</Badge></Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    {inv.status !== 'Paid' && (
                      <Button variant="outline" className="!px-2 !py-1 !text-xs" onClick={() => markPaid(inv)}>Mark paid</Button>
                    )}
                    <button title="Delete" aria-label="Delete invoice" onClick={() => remove(inv)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Icon name="trash" size={14} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}