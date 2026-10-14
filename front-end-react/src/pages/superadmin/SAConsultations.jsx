/**
 * Superadmin - Consultations: every booking on the platform with
 * cancel / delete actions and a status filter.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import Icon from '../../components/Icon.jsx';
import {
  Button, Card, Badge, PageHeader, Loading, ErrorBanner, Table, Th, Td, Input, Select,
} from '../../components/ui.jsx';
import { formatDate } from '../../lib/format.js';

const TERMINAL = ['COMPLETED', 'CANCELLED'];

export default function SAConsultations() {
  const { toast } = useApp();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  /* Try the full list first; some backends only expose workflow bookings. */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let data;
      try {
        data = await api.consultations.getAll({}, 'superadmin');
      } catch {
        data = await api.consultations.getWorkflowBookings('superadmin');
      }
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return list.filter((c) => {
      const okSearch = !q || `${c.clientName} ${c.firmName} ${c.lawyerName}`.toLowerCase().includes(q);
      const okStatus = statusFilter === 'all' || String(c.status).toUpperCase() === statusFilter.toUpperCase();
      return okSearch && okStatus;
    });
  }, [list, search, statusFilter]);

  const cancel = async (c) => {
    if (!window.confirm(`Cancel consultation ${c.id}?`)) return;
    try {
      await api.consultations.cancel(c.id, 'superadmin');
      toast('Consultation cancelled.');
      load();
    } catch (err) {
      toast(err.message || 'Cancel failed', 'error');
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Permanently delete ${c.id}?`)) return;
    try {
      await api.consultations.remove(c.id, 'superadmin');
      toast('Consultation deleted.');
      load();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  };

  if (loading) return <Loading text="Loading consultations…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <>
      <PageHeader title="Consultations" subtitle="Every booking made through the platform." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search client, firm or lawyer…" value={search} onChange={(e) => setSearch(e.target.value)} className="!w-72" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-40">
          <option value="all">All statuses</option>
          {['pending', 'confirmed', 'completed', 'cancelled'].map((s) => <option key={s} value={s.toUpperCase()}>{s}</option>)}
        </Select>
        <span className="text-xs font-semibold text-slate-400">{filtered.length} of {list.length}</span>
      </div>

      <Card>
        <Table>
          <thead>
            <tr><Th>ID</Th><Th>Client</Th><Th>Firm</Th><Th>Lawyer</Th><Th>Date</Th><Th>Status</Th><Th>Actions</Th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No consultations match your filters.</td></tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <Td className="font-mono text-xs font-bold">{c.id}</Td>
                <Td>
                  <span className="block text-sm font-semibold text-slate-800">{c.clientName || 'Unknown client'}</span>
                  <span className="block text-[10px] text-slate-400">{c.type}</span>
                </Td>
                <Td>{c.firmName || '—'}</Td>
                <Td>{c.lawyerName || 'Unassigned'}</Td>
                <Td className="text-xs">
                  {c.date || formatDate(c.createdAt)}
                  <span className="block text-[10px] text-slate-400">{c.time}</span>
                </Td>
                <Td>
                  <Badge variant={
                    c.status === 'COMPLETED' ? 'green' : c.status === 'CANCELLED' ? 'red' :
                    c.status === 'PENDING' ? 'amber' : 'blue'}>{c.status}</Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    {!TERMINAL.includes(String(c.status).toUpperCase()) && (
                      <Button variant="outline" className="!px-2 !py-1 !text-xs" onClick={() => cancel(c)}>Cancel</Button>
                    )}
                    <button title="Delete" aria-label="Delete consultation" onClick={() => remove(c)}
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