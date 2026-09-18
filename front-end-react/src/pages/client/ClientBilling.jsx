/**
 * Billing & Payments (client) - summary cards, searchable invoice table
 * with status filter tabs, and the 3 most recent payments.
 */

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import {
  Button, Card, Badge, StatusBadge, PageHeader, Loading, ErrorBanner, EmptyState, Table, Th, Td, Input, StatCard,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { money, formatDate } from '../../lib/format.js';

export default function ClientBilling() {
  const { user, toast } = useApp();

  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All'); // All | Paid | Pending | Overdue

  /* Headers the billing endpoints expect (same as vanilla billing-storage). */
  const headers = () => ({
    'x-user-id': user?.id || '',
    'x-user-name': user?.fullName || user?.name || '',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const role = (user?.role || 'client').toLowerCase();
      const [inv, pay] = await Promise.all([
        api.billing.getInvoices(role, headers()),
        api.billing.getPayments(role, headers()),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setPayments(Array.isArray(pay) ? pay : []);
    } catch (err) {
      setError(`Failed to load invoices: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  /* Apply the search box + status tab together. */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((inv) => {
      const okTab = filter === 'All' || inv.status === filter;
      const okSearch = !q || `${inv.id} ${inv.caseName}`.toLowerCase().includes(q);
      return okTab && okSearch;
    });
  }, [invoices, search, filter]);

  /* Summary maths (same rules as the vanilla script). */
  const totalBilled = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = invoices.filter((i) => i.status === 'Pending').reduce((s, i) => s + Number(i.amount || 0), 0);
  const overdue = invoices.filter((i) => i.status === 'Overdue').reduce((s, i) => s + Number(i.amount || 0), 0);

  /* Due-date colour: red for overdue, amber when due within 2 weeks, else green. */
  const dueClass = (inv) => {
    if (inv.status === 'Paid') return 'text-emerald-600';
    if (inv.status === 'Overdue') return 'text-red-600 font-bold';
    const days = (new Date(inv.dueDate) - new Date()) / 86400000;
    return days <= 14 ? 'text-amber-600 font-semibold' : 'text-slate-600';
  };

  return (
    <>
      <PageHeader
        title="Billing & Payments"
        subtitle="Your invoices, payments and outstanding dues."
        actions={<Button variant="outline" onClick={() => navigate('/client/transactions')}>View All Transactions</Button>}
      />

      {loading && <Loading text="Loading billing data…" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {/* ── Summary cards ── */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Amount Billed" value={money(totalBilled)} icon="dollar" tone="indigo" />
            <StatCard label="Total Paid" value={money(totalPaid)} icon="check" tone="blue" />
            <StatCard label="Pending Payments" value={money(pending)} icon="clock" tone="amber" />
            <StatCard label="Overdue Payments" value={money(overdue)} icon="alert" tone="red" />
          </div>

          {/* ── Invoices card ── */}
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <h2 className="font-bold text-slate-900">My Invoices</h2>
              <div className="flex flex-wrap items-center gap-3">
                <Input placeholder="Search invoices by invoice ID or case" value={search}
                  onChange={(e) => setSearch(e.target.value)} className="!w-64" />
                {/* status filter tabs */}
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                  {['All', 'Paid', 'Pending', 'Overdue'].map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold ${filter === f ? 'bg-white text-brand shadow-sm' : 'text-slate-500'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Table>
              <thead>
                <tr><Th>Invoice ID</Th><Th>Case Name</Th><Th>Amount</Th><Th>Status</Th><Th>Due Date</Th><Th>Actions</Th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><Td colSpan={6} className="!text-center text-slate-400">No invoices found.</Td></tr>
                ) : filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs font-bold text-slate-600">{inv.id}</Td>
                    <Td className="font-semibold text-slate-800">{inv.caseName || '—'}</Td>
                    <Td>{money(inv.amount)}</Td>
                    <Td><StatusBadge status={inv.status} /></Td>
                    <Td className={dueClass(inv)}>{formatDate(inv.dueDate)}</Td>
                    <Td>
                      {inv.status !== 'Paid' && (
                        <Button className="!px-3 !py-1.5 !text-xs" onClick={() => navigate(`/client/billing/pay/${encodeURIComponent(inv.id)}`)}>
                          Pay Now
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {/* ── Payment history card ── */}
          <Card>
            <div className="border-b border-slate-100 p-5">
              <h2 className="font-bold text-slate-900">Payment History</h2>
            </div>
            <Table>
              <thead>
                <tr><Th>Payment ID</Th><Th>Invoice ID</Th><Th>Amount Paid</Th><Th>Payment Date</Th><Th>Payment Method</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><Td colSpan={6} className="!text-center text-slate-400">No payment history.</Td></tr>
                ) : payments.slice(0, 3).map((p) => (   // only the 3 most recent, like vanilla
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs font-bold text-slate-600">{p.id}</Td>
                    <Td className="font-mono text-xs">{p.invoiceId}</Td>
                    <Td className="font-semibold">{money(p.amount)}</Td>
                    <Td>{formatDate(p.paymentDate || p.date)}</Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <Icon name={/bank/i.test(p.paymentMethod || p.method || '') ? 'download' : 'card'} size={14} className="text-slate-400" />
                        {p.paymentMethod || p.method || 'Card'}
                      </span>
                    </Td>
                    <Td><Badge variant="green">{p.status || 'Completed'}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}

