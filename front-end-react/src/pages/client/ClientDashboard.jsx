/**
 * Client Dashboard - "Consultations Dashboard".
 * Shows the client's upcoming consultations as cards and past ones in a table.
 * Actions: view details (modal), cancel a booking, open the chat room,
 * and a header button that jumps to the law-firm search page.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import {
  Button, Card, Badge, StatusBadge, Modal, PageHeader, Loading, ErrorBanner, EmptyState, Table, Th, Td, StatCard,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

/* Statuses that count as "upcoming" (same list as the vanilla script). */
const UPCOMING = ['PENDING', 'SCHEDULED', 'CONFIRMED', 'IN PROGRESS', 'IN_PROGRESS'];

export default function ClientDashboard() {
  const { user, toast } = useApp();

  const [consultations, setConsultations] = useState([]); // all my bookings
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(null);           // consultation shown in the modal

  /* Load every consultation for this client from the backend. */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const clientId = user.id || user.userId || user.clientId;
      if (!clientId) throw new Error('Could not determine client ID from session.');
      const list = await api.consultations.getMy(clientId, 'client');
      setConsultations(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.status === 403 ? 'Access denied. Please log in as a client.' : `Could not load consultations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* Cancel one consultation (after a browser confirm dialog). */
  const cancelConsultation = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this consultation?')) return;
    try {
      await api.consultations.cancel(id, 'client');
      toast('Consultation cancelled successfully.');
      load(); // refresh the lists
    } catch (err) {
      toast(`Failed to cancel: ${err.message}`, 'error');
    }
  };

  /* Open the details modal: fetch the full record first. */
  const openDetails = async (id) => {
    setDetails({ id }); // open the modal immediately with a loading feel
    try {
      setDetails(await api.consultations.getById(id, 'client'));
    } catch (err) {
      toast(`Could not load details: ${err.message}`, 'error');
      setDetails(null); // close on failure
    }
  };

  /* Split the list into the two sections. */
  const upcoming = consultations.filter((c) => UPCOMING.includes((c.status || '').toUpperCase()));
  const past = consultations.filter((c) => ['COMPLETED', 'CANCELLED'].includes((c.status || '').toUpperCase()));

  return (
    <>
      <PageHeader
        title="Consultations Dashboard"
        subtitle="Manage your upcoming and past legal consultations."
        actions={
          <Button onClick={() => navigate('/client/search')}>
            <Icon name="plus" size={14} /> Book Consultation
          </Button>
        }
      />

      {loading && <Loading text="Loading consultations…" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {/* ── Scheduled (upcoming) consultations ── */}
          <section className="mb-10">
            <h2 className="text-lg font-bold text-slate-900">Scheduled Consultations</h2>
            <p className="mb-4 text-sm text-slate-500">Upcoming consultations that have been confirmed.</p>

            {upcoming.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="No upcoming consultations."
                action={<Button variant="outline" onClick={() => navigate('/client/search')}>Book one now →</Button>}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((cons) => (
                  <Card key={cons.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      {/* avatar + names */}
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          <Icon name="user" size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="indigo">{cons.id}</Badge>
                            <StatusBadge status={cons.status} />
                          </div>
                          <h3 className="mt-1.5 truncate font-bold text-slate-900">
                            {cons.lawyerName || 'Awaiting Assignment'}
                          </h3>
                          <p className="truncate text-xs text-slate-500">
                            {cons.firmName} • {cons.type ? cons.type[0].toUpperCase() + cons.type.slice(1) : 'N/A'}
                          </p>
                        </div>
                      </div>
                      {/* date block */}
                      <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-center">
                        <p className="text-xs font-bold text-brand">{cons.date}</p>
                        <p className="text-[11px] text-slate-500">{cons.time?.split(' - ')[0]}</p>
                      </div>
                    </div>

                    {/* actions row */}
                    <div className="mt-4 flex items-center gap-2">
                      <Button variant="outline" className="flex-1 !py-1.5" onClick={() => openDetails(cons.id)}>
                        View Details
                      </Button>
                      {['SCHEDULED', 'CONFIRMED'].includes((cons.status || '').toUpperCase()) && (
                        <Button variant="ghost" className="!py-1.5" onClick={() => navigate(`/client/chat/${cons.id}`)}>
                          Join Chat
                        </Button>
                      )}
                      <Button variant="ghost" className="!py-1.5 !text-red-500 hover:!bg-red-50"
                        onClick={() => cancelConsultation(cons.id)}>
                        Cancel
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* ── Past consultations table ── */}
          <section>
            <h2 className="text-lg font-bold text-slate-900">Past Consultations</h2>
            <p className="mb-4 text-sm text-slate-500">History of your completed or cancelled consultations.</p>
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th>Consultation ID</Th><Th>Lawyer Name</Th><Th>Case Type</Th>
                    <Th>Date</Th><Th>Duration</Th><Th>Status</Th><Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {past.length === 0 ? (
                    <tr><Td colSpan={7} className="!text-center text-slate-400">No past consultation history.</Td></tr>
                  ) : (
                    past.map((cons) => (
                      <tr key={cons.id} className="hover:bg-slate-50">
                        <Td><button className="font-semibold text-indigo-600 hover:underline" onClick={() => openDetails(cons.id)}>{cons.id}</button></Td>
                        <Td>{cons.lawyerName || '—'}</Td>
                        <Td className="max-w-[220px] truncate">{cons.caseDescription ? cons.caseDescription.slice(0, 30) + '…' : 'Legal Advice'}</Td>
                        <Td>{cons.date}</Td>
                        <Td>30 min</Td>
                        <Td><StatusBadge status={cons.status} /></Td>
                        <Td>
                          <button className="text-sm font-medium text-indigo-600 hover:underline" onClick={() => openDetails(cons.id)}>
                            View Summary
                          </button>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card>
          </section>
        </>
      )}

      {/* ── Details modal ── */}
      <Modal open={!!details} onClose={() => setDetails(null)} title="Consultation Details" wide>
        {details && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Info label="Consultation ID"><Badge variant="indigo">{details.id}</Badge></Info>
            <Info label="Status"><StatusBadge status={details.status} /></Info>
            <Info label="Lawyer / Advocate">{details.lawyerName || 'Awaiting Assignment'}</Info>
            <Info label="Law Firm">{details.firmName || '—'}</Info>
            <Info label="Consultation Type">
              {details.type ? details.type[0].toUpperCase() + details.type.slice(1) : '—'}
            </Info>
            <Info label="Consultation Fee">{details.consultationFee || 'Not specified'}</Info>
            <Info label="Date">{details.date || '—'}</Info>
            <Info label="Time Slot">{details.time || '—'}</Info>
            <Info label="Case Description" full>
              <p className="rounded-lg bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-600">
                {details.caseDescription || '—'}
              </p>
            </Info>
            {details.notes && (
              <Info label="Lawyer Notes" full>
                <p className="rounded-lg bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-600">{details.notes}</p>
              </Info>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

/* One label/value pair inside the details modal grid. */
function Info({ label, children, full = false }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 font-semibold text-slate-800">{children}</div>
    </div>
  );
}