/**
 * Superadmin - Law Firms: full CRUD over law firms + tier assignment,
 * optional admin-account provisioning, and inline "mark charge paid".
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import {
  Button, Card, Badge, StatusBadge, PageHeader, Loading, ErrorBanner,
  Modal, Field, Input, Select, Table, Th, Td,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { initials, money, formatDate } from '../../lib/format.js';

const EMPTY_FORM = {
  name: '', tier: 'Starter', email: '', phone: '', city: '', state: '', street: '', pinCode: '',
  website: '', subtitle: '', adminName: '', adminEmail: '', adminPassword: '',
};

export default function SAFirms() {
  const { toast } = useApp();

  const [firms, setFirms] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [form, setForm] = useState(null); // null = closed
  const [busy, setBusy] = useState(false);

  /* Load firms + subscriptions + charges (all three tables join client-side). */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [f, s, c] = await Promise.all([
        api.users.getAllFirms('superadmin'),
        api.platform.getSubscriptions('superadmin').catch(() => []),
        api.platform.getCharges('superadmin').catch(() => []),
      ]);
      setFirms(Array.isArray(f) ? f : []);
      setSubscriptions(Array.isArray(s) ? s : []);
      setCharges(Array.isArray(c) ? c : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Look-ups for the table. */
  const subFor = (firmId) => subscriptions.find((s) => s.firmId === firmId);
  /* The firm's most recent charge (string compare works for period labels). */
  const currentCharge = (firmId) =>
    [...charges].filter((c) => c.firmId === firmId).sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];

  /* Filter + search. */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return firms.filter((f) => {
      const okSearch = !q || `${f.name} ${f.email} ${f.city} ${f.id}`.toLowerCase().includes(q);
      const okTier = tierFilter === 'all' || f.tier === tierFilter;
      return okSearch && okTier;
    });
  }, [firms, search, tierFilter]);

  /* Save = create or update. */
  const saveFirm = async () => {
    const f = form;
    if (!f.name.trim() || !f.email.trim() || !f.phone.trim()) {
      toast('Firm name, contact email and phone are required.', 'error');
      return;
    }
    setBusy(true);
    try {
      // Only send non-empty keys (backend validates per-field).
      const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null));
      if (f.id) {
        delete body.adminName; delete body.adminEmail; delete body.adminPassword; // not editable
        await api.users.updateFirm(f.id, body);
        toast('Firm updated.');
      } else {
        await api.users.createFirm(body);
        toast('Firm added.');
      }
      setForm(null);
      load();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  /* Delete with the two-step cascade (backend 400 = firm still has members). */
  const deleteFirm = async (firm) => {
    if (!window.confirm(`Delete "${firm.name}"? This also ends its subscription.`)) return;
    try {
      await api.users.deleteFirm(firm.id);
      toast('Firm deleted.');
      load();
    } catch (err) {
      if (err.status === 400) {
        // The firm still has members - offer the cascade delete.
        if (window.confirm(`${err.message}\n\nDelete the firm and its members anyway?`)) {
          try {
            await api.users.deleteFirm(firm.id, true);
            toast('Firm and its members deleted.');
            load();
          } catch (e2) {
            toast(e2.message || 'Delete failed', 'error');
          }
        }
      } else {
        toast(err.message || 'Delete failed', 'error');
      }
    }
  };

  /* Inline "mark paid" for the firm's current charge. */
  const markChargePaid = async (charge) => {
    try {
      await api.platform.updateChargeStatus(charge.id, 'Paid', 'superadmin');
      toast('Subscription charge marked paid.');
      load();
    } catch (err) {
      toast(err.message || 'Update failed', 'error');
    }
  };

  if (loading) return <Loading text="Loading firms…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="Law Firms"
        subtitle="Every firm on the platform, with its tier and subscription."
        actions={<Button onClick={() => setForm({ ...EMPTY_FORM })}><Icon name="plus" size={14} /> Add law firm</Button>}
      />

      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search name, email, city or ID…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="!w-72" />
        <Select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="!w-40">
          <option value="all">All tiers</option>
          {['Starter', 'Growth', 'Enterprise'].map((t) => <option key={t}>{t}</option>)}
        </Select>
        <span className="text-xs font-semibold text-slate-400">{filtered.length} of {firms.length} firms</span>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Firm</Th><Th>Contact</Th><Th>City</Th><Th>Tier</Th><Th>Price / mo</Th>
              <Th>Subscription</Th><Th>This month</Th><Th>Joined</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No firms match your filters.</td></tr>
            ) : filtered.map((f) => {
              const sub = subFor(f.id);
              const charge = currentCharge(f.id);
              return (
                <tr key={f.id} className="hover:bg-slate-50">
                  <Td>
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{initials(f.name)}</span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{f.name}</span>
                        <span className="block font-mono text-[10px] text-slate-400">{f.id}</span>
                      </span>
                    </span>
                  </Td>
                  <Td>
                    <span className="block text-xs">{f.email}</span>
                    <span className="block text-[10px] text-slate-400">{f.phone}</span>
                  </Td>
                  <Td>{f.city || '—'}</Td>
                  <Td><Badge variant="blue">{f.tier}</Badge></Td>
                  <Td>{sub ? money(sub.monthlyPrice, 0) : '—'}</Td>
                  <Td><StatusBadge status={String(sub?.status || '—').replace('_', ' ')} /></Td>
                  <Td>
                    {!charge ? '—' : charge.status === 'Paid' ? <Badge variant="green">Paid</Badge> : (
                      <span className="flex items-center gap-2">
                        <StatusBadge status={charge.status} />
                        <Button variant="outline" className="!px-2 !py-0.5 !text-[10px]" onClick={() => markChargePaid(charge)}>Mark paid</Button>
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs">{formatDate(f.createdAt)}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <button title="Edit" aria-label="Edit firm" onClick={() => setForm({ ...EMPTY_FORM, ...f, id: f.id })}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><Icon name="edit" size={14} /></button>
                      <button title="Delete" aria-label="Delete firm" onClick={() => deleteFirm(f)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Icon name="trash" size={14} /></button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {/* ── Add/Edit modal ── */}
      <Modal open={!!form} onClose={() => setForm(null)} wide
        title={form?.id ? 'Edit law firm' : 'Add law firm'}
        subtitle={form?.id ? `Updating ${form.name}. Changing the tier moves its seat limits and monthly price.`
          : 'A subscription starts on the selected tier as soon as the firm is created.'}
        footer={<>
          <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          <Button loading={busy} onClick={saveFirm}>Save firm</Button>
        </>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Firm name" required className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))} />
            </Field>
            <Field label="Tier">
              <Select value={form.tier} onChange={(e) => setForm((x) => ({ ...x, tier: e.target.value }))}>
                {['Starter', 'Growth', 'Enterprise'].map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Contact email" required>
              <Input type="email" value={form.email} onChange={(e) => setForm((x) => ({ ...x, email: e.target.value }))} />
            </Field>
            <Field label="Phone" required>
              <Input value={form.phone} onChange={(e) => setForm((x) => ({ ...x, phone: e.target.value }))} />
            </Field>
            <Field label="City"><Input value={form.city} onChange={(e) => setForm((x) => ({ ...x, city: e.target.value }))} /></Field>
            <Field label="State"><Input value={form.state} onChange={(e) => setForm((x) => ({ ...x, state: e.target.value }))} /></Field>
            <Field label="PIN code"><Input value={form.pinCode} onChange={(e) => setForm((x) => ({ ...x, pinCode: e.target.value }))} /></Field>
            <Field label="Street" className="sm:col-span-2">
              <Input value={form.street} onChange={(e) => setForm((x) => ({ ...x, street: e.target.value }))} />
            </Field>
            <Field label="Website"><Input value={form.website} onChange={(e) => setForm((x) => ({ ...x, website: e.target.value }))} /></Field>
            <Field label="Tagline"><Input value={form.subtitle} onChange={(e) => setForm((x) => ({ ...x, subtitle: e.target.value }))} /></Field>

            {/* creation-only admin account block */}
            {!form.id && (
              <>
                <p className="pt-2 text-xs font-bold uppercase tracking-wide text-slate-400 sm:col-span-2">
                  Firm admin account (optional)
                </p>
                <Field label="Admin name"><Input value={form.adminName} onChange={(e) => setForm((x) => ({ ...x, adminName: e.target.value }))} /></Field>
                <Field label="Admin email"><Input type="email" value={form.adminEmail} onChange={(e) => setForm((x) => ({ ...x, adminEmail: e.target.value }))} /></Field>
                <Field label="Password" className="sm:col-span-2">
                  <Input value={form.adminPassword} onChange={(e) => setForm((x) => ({ ...x, adminPassword: e.target.value }))} placeholder="min 6 characters" />
                </Field>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}