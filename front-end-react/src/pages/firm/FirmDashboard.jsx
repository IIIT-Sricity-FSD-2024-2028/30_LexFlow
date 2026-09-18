/**
 * Firm Dashboard - incoming consultation requests + active consultations.
 * Actions: accept (assign lawyer), reject, cancel, convert to case.
 * Serves firmAdmin, lawyer AND intern (one page replaces the vanilla
 * firm-consultation-dashboard).
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import {
  Button, Card, Badge, StatusBadge, PageHeader, Loading, ErrorBanner, EmptyState, Table, Th, Td, Select, StatCard,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

const ACTIVE = ['SCHEDULED', 'CONFIRMED', 'IN PROGRESS', 'IN_PROGRESS'];

export default function FirmDashboard() {
  const { user, toast } = useApp();
  const role = (user?.role || 'firmadmin').toLowerCase();

  const [consultations, setConsultations] = useState([]);
  const [lawyers, setLawyers] = useState([]);       // for the assignment dropdown
  const [chosen, setChosen] = useState({});          // consultationId -> lawyerId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Load consultations + the firm's lawyers. */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = user?.firmId ? { firmId: user.firmId } : {};
      const [cons, law] = await Promise.all([
        api.consultations.getAll(filters, role),
        api.users.getLawyers(user?.firmId, role),
      ]);
      setConsultations(Array.isArray(cons) ? cons : []);
      setLawyers((Array.isArray(law) ? law : []).filter((u) => (u.role || '').toLowerCase() === 'lawyer'));
    } catch (err) {
      setError(err.status === 403 ? 'Access denied. Please log in as a firm admin.' : `Could not load: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [role, user?.firmId]);

  useEffect(() => { load(); }, [load]);

  /* The three headline numbers. */
  const pending = consultations.filter((c) => (c.status || '').toUpperCase() === 'PENDING');
  const active = consultations.filter((c) => ACTIVE.includes((c.status || '').toUpperCase()));
  const completed = consultations.filter((c) => (c.status || '').toUpperCase() === 'COMPLETED');

  /* ACCEPT a request: needs a lawyer chosen in the row's dropdown. */
  const accept = async (cons) => {
    const lawyerId = chosen[cons.id];
    if (!lawyerId) {
      toast('Please choose a lawyer to assign first.', 'error');
      return;
    }
    const lawyer = lawyers.find((l) => l.id === lawyerId);
    try {
      await api.consultations.update(cons.id, {
        status: 'CONFIRMED',
        lawyerId,
        lawyerName: lawyer?.fullName || lawyer?.name,
      }, role);
      toast('Consultation accepted and lawyer assigned.');
      load();
    } catch (err) {
      toast(`Failed to accept: ${err.message}`, 'error');
    }
  };

  /* REJECT a pending request (cancel endpoint). */
  const reject = async (id) => {
    if (!window.confirm('Reject this consultation request?')) return;
    try {
      await api.consultations.cancel(id, role);
      toast('Consultation request rejected.');
      load();
    } catch (err) {
      toast(`Failed to reject: ${err.message}`, 'error');
    }
  };

  /* CANCEL an already-active consultation. */
  const cancel = async (id) => {
    if (!window.confirm('Cancel this active consultation?')) return;
    try {
      await api.consultations.cancel(id, role);
      toast('Consultation cancelled.');
      load();
    } catch (err) {
      toast(`Failed to cancel: ${err.message}`, 'error');
    }
  };

  /* CONVERT an active consultation into a formal case. */
  const convertToCase = async (cons) => {
    const caseType = window.prompt('Enter the Case Name/Type:', (cons.type || 'consultation').toUpperCase());
    if (!caseType) return; // user cancelled the prompt
    try {
      const cnr = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit CNR like vanilla
      await api.cases.create({
        consultation_id: cons.id,
        lawfirm_id: user.firmId,
        lawyer_id: cons.lawyerId || '',
        client_id: cons.clientId,
        cnr,
        case_type: caseType,
        brief_description: cons.caseDescription || '',
        status: 'Active',
        filed_date: new Date().toISOString().slice(0, 10),
      }, role);
      // Mark the consultation finished so it leaves the active table.
      await api.consultations.update(cons.id, { status: 'COMPLETED' }, role);
      toast(`Successfully converted to Case ${cnr}!`);
      load();
    } catch (err) {
      toast(`Failed to convert: ${err.message}`, 'error');
    }
  };

  return (
    <>
      <PageHeader title="Consultations" subtitle="Incoming requests and ongoing consultations for your firm." />

      {/* ── Stat cards ── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending Requests" value={pending.length} icon="clock" tone="amber" />
        <StatCard label="Active Consultations" value={active.length} icon="check" tone="blue" />
        <StatCard label="Completed This Month" value={completed.length} icon="check" tone="green" />
      </div>

      {loading && <Loading text="Loading consultations…" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {/* ── Incoming requests ── */}
          <section className="mb-10">
            <h2 className="mb-1 text-lg font-bold text-slate-900">Incoming Requests</h2>
            <p className="mb-4 text-sm text-slate-500">New consultation requests waiting for approval.</p>

            {pending.length === 0 ? (
              <EmptyState icon="calendar" title="No pending requests at the moment." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pending.map((cons) => (
                  <Card key={cons.id} className="p-5">
                    <div className="flex items-center justify-between">
                      <Badge variant="indigo">{cons.id}</Badge>
                      <Badge variant="amber">{(cons.type || 'chat').toUpperCase()}</Badge>
                    </div>
                    <h3 className="mt-3 font-bold text-slate-900">{cons.clientName || 'Unknown Client'}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{cons.caseDescription || 'No description provided.'}</p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Icon name="calendar" size={12} /> {cons.date}</span>
                      <span className="flex items-center gap-1"><Icon name="clock" size={12} /> {(cons.time || '').split(' - ')[0]}</span>
                    </div>
                    {/* lawyer picker + actions */}
                    <div className="mt-4 space-y-2">
                      <Select value={chosen[cons.id] || ''} onChange={(e) => setChosen((c) => ({ ...c, [cons.id]: e.target.value }))}>
                        <option value="">Assign a lawyer…</option>
                        {lawyers.map((l) => (
                          <option key={l.id} value={l.id}>{l.fullName || l.name} ({l.email})</option>
                        ))}
                      </Select>
                      <div className="flex gap-2">
                        <Button className="flex-1 !py-1.5 !text-xs" onClick={() => accept(cons)}>Accept</Button>
                        <Button variant="ghost" className="!py-1.5 !text-xs !text-red-500 hover:!bg-red-50" onClick={() => reject(cons.id)}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* ── Active consultations table ── */}
          <section>
            <h2 className="mb-1 text-lg font-bold text-slate-900">Active Consultations</h2>
            <p className="mb-4 text-sm text-slate-500">Confirmed consultations currently in progress.</p>
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th>ID</Th><Th>Client</Th><Th>Assigned Lawyer</Th><Th>Case Type</Th>
                    <Th>Scheduled</Th><Th>Mode</Th><Th>Status</Th><Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {active.length === 0 ? (
                    <tr><Td colSpan={8} className="!text-center text-slate-400">No active consultations at the moment.</Td></tr>
                  ) : active.map((cons) => (
                    <tr key={cons.id} className="hover:bg-slate-50">
                      <Td className="font-mono text-xs font-bold">{cons.id}</Td>
                      <Td className="font-semibold">{cons.clientName || '—'}</Td>
                      <Td>
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${cons.lawyerId ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                          {cons.lawyerName || 'Unassigned'}
                        </span>
                      </Td>
                      <Td>{(cons.type || '').toUpperCase() || '—'}</Td>
                      <Td className="text-xs">{cons.date}<br /><span className="text-slate-400">{cons.time}</span></Td>
                      <Td><Badge variant="blue">{(cons.type || 'chat').toUpperCase()}</Badge></Td>
                      <Td><StatusBadge status={cons.status} /></Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => navigate2Chat(cons.id)}>Chat</Button>
                          <Button variant="outline" className="!px-2 !py-1 !text-xs" onClick={() => convertToCase(cons)}>Convert to Case</Button>
                          <Button variant="ghost" className="!px-2 !py-1 !text-xs !text-red-500 hover:!bg-red-50" onClick={() => cancel(cons.id)}>Cancel</Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </section>
        </>
      )}
    </>
  );

  function navigate2Chat(id) {
    sessionStorage.setItem('active_cons_id', id);
    window.location.hash = '/firm/chat';
  }
}