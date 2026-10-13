/**
 * Firm Billing - invoices + payments + the firm's platform subscription.
 * Cards: 4 summaries, Subscription Charges, Your Plan, Invoices
 * (search + tabs + CRUD + print), Payment History.
 * Serves firmAdmin and lawyer (interns are blocked by the route guard).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import {
  Button, Card, Badge, StatusBadge, PageHeader, Loading, ErrorBanner, StatCard,
  Modal, Field, Input, Select, Table, Th, Td,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { money, formatDate } from '../../lib/format.js';

export default function FirmBilling() {
  const { user, toast } = useApp();
  const role = (user?.role || 'firmadmin').toLowerCase();

  /* ── Data ── */
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);           // for the "bill to" dropdown
  const [charges, setCharges] = useState([]);           // platform subscription charges
  const [subscription, setSubscription] = useState(null); // { tier, monthlyPrice, pendingTier }
  const [tiers, setTiers] = useState([]);               // available plans
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* ── Toolbar state ── */
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  /* ── Modals: create / edit / view invoice ── */
  const [creating, setCreating] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);

  /* Extra headers the billing endpoints expect. */
  const hdrs = () => ({ 'x-user-id': user?.id || '' });

  /* ── Load everything ── */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [inv, pay, cl] = await Promise.all([
        api.billing.getInvoices(role, hdrs()),
        api.billing.getPayments(role, hdrs()),
        api.billing.getClients(role, hdrs()).catch(() => []),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setPayments(Array.isArray(pay) ? pay : []);
      setClients(Array.isArray(cl) ? cl : []);

      // Subscription pieces fail independently so the page still works.
      try {
        const ch = await api.platform.getCharges(role, user?.firmId, user?.id);
        setCharges(Array.isArray(ch) ? ch : []);
      } catch { /* ignore */ }
      if (user?.firmId) {
        try {
          const sub = await api.platform.getSubscription(user.firmId, role, user?.id);
          setSubscription(sub);
        } catch { /* ignore */ }
        try {
          const t = await api.platform.getTierPlans(role);
          setTiers(Array.isArray(t) ? t : []);
        } catch { /* ignore */ }
      }
    } catch (err) {
      setError(`Failed to load billing data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [role, user?.firmId, user?.id]);

  useEffect(() => { load(); }, [load]);

  /* ── Summary maths ── */
  const totalBilled = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingAmt = invoices.filter((i) => ['Pending', 'Overdue'].includes(i.status))
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const overdueCount = invoices.filter((i) => i.status === 'Overdue').length;

  /* ── Invoice filtering ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((inv) => {
      const okTab = filter === 'All' || inv.status === filter;
      const okSearch = !q || `${inv.id} ${inv.caseName} ${inv.clientName}`.toLowerCase().includes(q);
      return okTab && okSearch;
    });
  }, [invoices, search, filter]);

  /* Subscription charges: newest period first. */
  const sortedCharges = [...charges].sort((a, b) => String(b.period).localeCompare(String(a.period)));

  /* ════════ INVOICE ACTIONS ════════ */

  const createInvoice = async () => {
    const c = creating;
    if (!c.clientId || !c.caseName.trim() || !Number(c.amount) || !c.dueDate) {
      toast('Please fill client, case name, amount and due date.', 'error');
      return;
    }
    setBusy(true);
    try {
      const created = await api.billing.createInvoice({
        clientId: c.clientId, caseName: c.caseName.trim(),
        amount: Number(c.amount), status: c.status, dueDate: c.dueDate,
      }, role, hdrs());
      setInvoices((list) => [created, ...list]); // newest on top
      toast('Invoice created.');
      setCreating(null);
    } catch (err) {
      toast(`Create failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    const e = editing;
    setBusy(true);
    try {
      const updated = await api.billing.updateInvoice(e.id, {
        clientId: e.clientId, caseName: e.caseName.trim(),
        amount: Number(e.amount), status: e.status, dueDate: e.dueDate,
      }, role, hdrs());
      setInvoices((list) => list.map((i) => (i.id === e.id ? { ...i, ...updated } : i)));
      toast('Invoice updated.');
      setEditing(null);
    } catch (err) {
      toast(`Update failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteInvoice = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.id}? This cannot be undone.`)) return;
    try {
      await api.billing.deleteInvoice(inv.id, role, hdrs());
      setInvoices((list) => list.filter((i) => i.id !== inv.id));
      toast('Invoice deleted.');
    } catch (err) {
      toast(`Delete failed: ${err.message}`, 'error');
    }
  };

  /* Fill the hidden print template and open the browser print dialog. */
  const printInvoice = (inv) => {
    setViewing({ ...inv, printing: true });
    setTimeout(() => {
      window.print(); // choose "Save as PDF" in the dialog; this waits until it closes
      setViewing({ ...inv, printing: false }); // go back to the normal invoice view
    }, 100); // give React a moment to render the template
  };

  /* ════════ SUBSCRIPTION ACTIONS ════════ */

  /* Pay one subscription charge. */
  const payCharge = async (charge) => {
    try {
      const updated = await api.platform.updateChargeStatus(charge.id, 'Paid', role, user?.id);
      setCharges((list) => list.map((c) => (c.id === charge.id ? { ...c, ...updated } : c)));
      toast('Subscription charge marked paid.');
    } catch (err) {
      toast(`Payment failed: ${err.message}`, 'error');
    }
  };

  /* Request a tier change (the backend issues a one-time charge). */
  const switchPlan = async (tier) => {
    if (!window.confirm(`Switch plan to ${tier.tier}? A one-time charge of ₹${tier.monthlyPrice} will be issued — pay it below to apply the change.`)) return;
    try {
      await api.platform.requestTierChange(user.firmId, tier.tier, role, user?.id);
      toast('Plan change requested. Pay the new charge below to apply it.');
      load(); // refresh charges + subscription
    } catch (err) {
      toast(`Plan change failed: ${err.message}`, 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Billing Management"
        subtitle="Invoices, payments and your platform subscription."
        actions={<Button onClick={() => { setCreating({ clientId: '', caseName: '', amount: '', status: 'Pending', dueDate: '' }); }}>
          <Icon name="plus" size={14} /> Create Invoice
        </Button>}
      />

      {loading && <Loading text="Loading billing data…" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {/* ── Summary cards ── */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Amount Paid" value={money(totalPaid)} icon="check" tone="green" />
            <StatCard label="Pending Payments" value={money(pendingAmt)} icon="clock" tone="amber" />
            <StatCard label="Total Billed" value={money(totalBilled)} icon="dollar" tone="indigo" />
            <StatCard label="Overdue Invoices" value={overdueCount} icon="alert" tone="red" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* ── Subscription charges ── */}
            <Card>
              <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Subscription Charges</h2></div>
              <Table>
                <thead><tr><Th>Charge</Th><Th>Period</Th><Th>Tier</Th><Th>Amount</Th><Th>Status</Th><Th>Action</Th></tr></thead>
                <tbody>
                  {sortedCharges.length === 0 ? (
                    <tr><Td colSpan={6} className="!text-center text-slate-400">No charges yet.</Td></tr>
                  ) : sortedCharges.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <Td className="font-mono text-xs font-bold">{c.id}</Td>
                      <Td className="text-xs">{c.period}</Td>
                      <Td><Badge variant="blue">{c.tier}</Badge></Td>
                      <Td className="font-semibold">{money(c.amount)}</Td>
                      <Td><StatusBadge status={c.status} /></Td>
                      <Td>
                        {c.status === 'Paid'
                          ? <span className="text-xs text-slate-400">Settled</span>
                          : <Button className="!px-3 !py-1 !text-xs" onClick={() => payCharge(c)}>Pay now</Button>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            {/* ── Your plan ── */}
            <Card className="p-5">
              <h2 className="font-bold text-slate-900">Your Plan</h2>
              {subscription ? (
                <>
                  <p className="mt-2 text-sm text-slate-600">
                    Current tier: <b>{subscription.tier}</b> — {money(subscription.monthlyPrice, 0)}/month
                  </p>
                  {subscription.pendingTier && (
                    <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      {subscription.pendingTier} pending: pay the charge below to switch.
                    </p>
                  )}
                  {/* one button per other tier */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tiers.filter((t) => t.tier !== subscription.tier).map((t) => (
                      <Button key={t.tier} variant="outline" className="!text-xs"
                        onClick={() => switchPlan(t)}>
                        Switch to {t.tier} — ₹{Number(t.monthlyPrice).toLocaleString('en-IN')}/mo
                        ({t.lawyerSeats >= 10000 ? '∞' : t.lawyerSeats} lawyers)
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Subscription information unavailable.</p>
              )}
            </Card>
          </div>

          {/* ── Invoices card ── */}
          <Card className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <h2 className="font-bold text-slate-900">Invoices</h2>
              <div className="flex flex-wrap items-center gap-3">
                <Input placeholder="Search Invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="!w-56" />
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
                <tr><Th>Invoice ID</Th><Th>Client</Th><Th>Case</Th><Th>Amount</Th><Th>Status</Th><Th>Due Date</Th><Th>Actions</Th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><Td colSpan={6} className="!text-center text-slate-400">No invoices found.</Td></tr>
                ) : filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <Td>
                      <button className="font-mono text-xs font-bold text-indigo-600 hover:underline"
                        onClick={() => setViewing(inv)}>{inv.id}</button>
                    </Td>
                    <Td className="font-semibold">{inv.clientName || '—'}</Td>
                    <Td>{inv.caseName || '—'}</Td>
                    <Td>{money(inv.amount)}</Td>
                    <Td><StatusBadge status={inv.status} /></Td>
                    <Td>{formatDate(inv.dueDate)}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <IconBtn icon="eye" title="View" onClick={() => setViewing(inv)} />
                        <IconBtn icon="edit" title="Edit" onClick={() => setEditing({
                          id: inv.id, clientId: inv.clientId || '', caseName: inv.caseName || '',
                          amount: inv.amount, status: inv.status, dueDate: (inv.dueDate || '').slice(0, 10),
                        })} />
                        <IconBtn icon="trash" title="Delete" danger onClick={() => deleteInvoice(inv)} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {/* ── Payment history card ── */}
          <Card className="mt-6">
            <div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Payment History</h2></div>
            <Table>
              <thead>
                <tr><Th>Payment ID</Th><Th>Invoice ID</Th><Th>Client</Th><Th>Amount</Th><Th>Payment Date</Th><Th>Method</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><Td colSpan={7} className="!text-center text-slate-400">No payments yet.</Td></tr>
                ) : payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs font-bold">{p.id}</Td>
                    <Td className="font-mono text-xs">{p.invoiceId}</Td>
                    <Td>{p.clientName || '—'}</Td>
                    <Td className="font-semibold">{money(p.amount)}</Td>
                    <Td>{formatDate(p.paymentDate || p.date)}</Td>
                    <Td>{p.paymentMethod || p.method || 'Card'}</Td>
                    <Td><Badge variant="green">{p.status || 'Completed'}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      {/* ════════ CREATE INVOICE MODAL ════════ */}
      <Modal open={!!creating} onClose={() => setCreating(null)} title="Create Invoice"
        footer={<>
          <Button variant="ghost" onClick={() => setCreating(null)}>Cancel</Button>
          <Button loading={busy} onClick={createInvoice}>Create</Button>
        </>}>
        {creating && (
          <div className="space-y-4">
            <Field label="Client" required>
              {/* choosing an option stores BOTH the id and email */}
              <Select value={creating.clientId}
                onChange={(e) => {
                  const opt = e.target.selectedOptions[0];
                  setCreating((c) => ({ ...c, clientId: e.target.value, clientEmail: opt?.dataset.email || '', clientName: opt?.dataset.name || '' }));
                }}>
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} data-email={c.email} data-name={c.fullName || c.name}>
                    {c.fullName || c.name} — {c.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Case Name" required>
              <Input value={creating.caseName} onChange={(e) => setCreating((c) => ({ ...c, caseName: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (₹)" required>
                <Input type="number" min="1" step="0.01" value={creating.amount}
                  onChange={(e) => setCreating((c) => ({ ...c, amount: e.target.value }))} />
              </Field>
              <Field label="Status">
                <Select value={creating.status} onChange={(e) => setCreating((c) => ({ ...c, status: e.target.value }))}>
                  {['Pending', 'Paid', 'Overdue'].map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Due Date" required>
              <Input type="date" value={creating.dueDate} onChange={(e) => setCreating((c) => ({ ...c, dueDate: e.target.value }))} />
            </Field>
          </div>
        )}
      </Modal>

      {/* ════════ EDIT INVOICE MODAL ════════ */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Invoice"
        footer={<>
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button loading={busy} onClick={saveEdit}>Save Changes</Button>
        </>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Client" required>
              <Select value={editing.clientId} onChange={(e) => setEditing((c) => ({ ...c, clientId: e.target.value }))}>
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName || c.name} — {c.email}</option>)}
                {/* keep the existing value selectable even if not in the list */}
                {!clients.some((c) => c.id === editing.clientId) && editing.clientId && (
                  <option value={editing.clientId}>{editing.clientName || editing.clientId}</option>
                )}
              </Select>
            </Field>
            <Field label="Case Name" required>
              <Input value={editing.caseName} onChange={(e) => setEditing((c) => ({ ...c, caseName: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (₹)" required>
                <Input type="number" min="1" step="0.01" value={editing.amount}
                  onChange={(e) => setEditing((c) => ({ ...c, amount: e.target.value }))} />
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing((c) => ({ ...c, status: e.target.value }))}>
                  {['Paid', 'Pending', 'Overdue'].map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Due Date" required>
              <Input type="date" value={editing.dueDate} onChange={(e) => setEditing((c) => ({ ...c, dueDate: e.target.value }))} />
            </Field>
          </div>
        )}
      </Modal>

      {/* ════════ VIEW INVOICE MODAL ════════ */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Invoice Details"
        footer={<>
          <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
          <Button onClick={() => printInvoice(viewing)}>Download PDF</Button>
        </>}>
        {viewing && !viewing.printing && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-800">{viewing.id}</span>
              <StatusBadge status={viewing.status} />
            </div>
            <Row label="Client" value={viewing.clientName || '—'} />
            <Row label="Client Email" value={viewing.clientEmail || '—'} />
            <Row label="Case" value={viewing.caseName || '—'} />
            <Row label="Advocate" value={viewing.advocateName || '—'} />
            <Row label="Amount" value={money(viewing.amount)} />
            <Row label="Due Date" value={formatDate(viewing.dueDate)} />
            <Row label="Created" value={formatDate(viewing.createdAt)} />
          </div>
        )}
      </Modal>

      {/* ════════ PRINT TEMPLATE (hidden on screen, used by window.print) ════════ */}
      {viewing?.printing && (
        <div className="fixed inset-0 z-[2000] bg-white p-10 print:static">
          <div className="mx-auto max-w-md">
            <div className="flex items-center justify-between border-b-2 border-brand pb-4">
              <span className="text-2xl font-extrabold text-brand">LexFlow</span>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Official Invoice</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Billed To</p>
                <p className="font-semibold">{viewing.clientName}</p>
                <p className="text-xs text-slate-500">{viewing.clientEmail}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-slate-400">Invoice ID</p>
                <p className="font-mono font-semibold">{viewing.id}</p>
                <p className="text-xs text-slate-500">{formatDate(viewing.createdAt || new Date())}</p>
              </div>
            </div>
            <table className="mt-6 w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2">Description</th><th className="py-2 text-right">Amount</th>
              </tr></thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-3">Legal Services — {viewing.caseName}</td>
                  <td className="py-3 text-right">{money(viewing.amount)}</td>
                </tr>
                <tr><td className="pt-3 font-bold">TOTAL</td><td className="pt-3 text-right font-bold">{money(viewing.amount)}</td></tr>
              </tbody>
            </table>
            <p className="mt-8 text-xs text-slate-400">Due {formatDate(viewing.dueDate)} · This is a computer-generated invoice.</p>
          </div>
        </div>
      )}
    </>
  );
}

/* Small helpers */
function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}
function IconBtn({ icon, title, danger = false, onClick }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className={`rounded-lg p-1.5 hover:bg-slate-100 ${danger ? 'text-slate-400 hover:text-red-500' : 'text-slate-400 hover:text-indigo-600'}`}>
      <Icon name={icon} size={14} />
    </button>
  );
}