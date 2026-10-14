/**
 * Superadmin - Lawyers & Interns: cross-firm roster with search, status
 * filter and activate/deactivate toggles.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import {
  Button, Card, Badge, PageHeader, Loading, ErrorBanner, Table, Th, Td, Input, Select,
} from '../../components/ui.jsx';
import { initials } from '../../lib/format.js';

export default function SALawyers() {
  const { toast } = useApp();

  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.users.getLawyers(null, 'superadmin');
      setLawyers(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return lawyers.filter((u) => {
      const okSearch = !q || `${u.fullName || u.name} ${u.email} ${u.firmId} ${u.id}`.toLowerCase().includes(q);
      const okStatus = statusFilter === 'all' || (u.accountStatus || 'active') === statusFilter;
      return okSearch && okStatus;
    });
  }, [lawyers, search, statusFilter]);

  /* Toggle the account status of one member. */
  const toggle = async (u) => {
    const next = (u.accountStatus || 'active') === 'active' ? 'inactive' : 'active';
    try {
      await api.users.update(u.id, { accountStatus: next }, 'superadmin');
      toast(next === 'active' ? 'Account activated' : 'Account deactivated');
      load();
    } catch (err) {
      toast(err.message || 'Update failed', 'error');
    }
  };

  if (loading) return <Loading text="Loading lawyers…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <>
      <PageHeader title="Lawyers & Interns" subtitle="Every legal team member across all firms." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search name, email or firm…" value={search} onChange={(e) => setSearch(e.target.value)} className="!w-72" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-36">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <span className="text-xs font-semibold text-slate-400">{filtered.length} of {lawyers.length}</span>
      </div>

      <Card>
        <Table>
          <thead>
            <tr><Th>Name</Th><Th>Role</Th><Th>Firm</Th><Th>Account</Th><Th>Availability</Th><Th>Action</Th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No members match your filters.</td></tr>
            ) : filtered.map((u) => {
              const active = (u.accountStatus || 'active') === 'active';
              return (
                <tr key={u.id} className="hover:bg-slate-50">
                  <Td>
                    <span className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{initials(u.fullName || u.name)}</span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{u.fullName || u.name}</span>
                        <span className="block text-[10px] text-slate-400">{u.email}</span>
                      </span>
                    </span>
                  </Td>
                  <Td><Badge variant={u.role === 'lawyer' ? 'blue' : 'slate'}>{u.role}</Badge></Td>
                  <Td className="font-mono text-xs">{u.firmId || 'Unassigned'}</Td>
                  <Td><Badge variant={active ? 'green' : 'red'}>{active ? 'active' : 'inactive'}</Badge></Td>
                  <Td className="text-xs capitalize">{u.availability || '—'}</Td>
                  <Td>
                    <Button variant="outline" className="!px-3 !py-1 !text-xs" onClick={() => toggle(u)}>
                      {active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}