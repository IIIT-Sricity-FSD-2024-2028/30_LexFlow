/**
 * User Management (firmAdmin only) - list, search, filter, add, edit,
 * delete firm members + a JSON export button. Pagination: 8 per page.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import {
  Button, Card, Badge, PageHeader, Loading, ErrorBanner, EmptyState,
  Modal, Field, Input, Select, Table, Th, Td, Pagination, Avatar,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { roleLabel } from '../../lib/format.js';

const PER_PAGE = 8;

/* How each role renders as a badge. */
const roleTone = { firmadmin: 'purple', superadmin: 'purple', lawyer: 'blue', intern: 'slate', client: 'green' };

export default function FirmUsers() {
  const { user, toast } = useApp();

  /* ── Data ── */
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* ── Toolbar ── */
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);

  /* ── Add/Edit modal ── */
  const [form, setForm] = useState(null); // null = closed
  const [busy, setBusy] = useState(false);

  /* ── Load the firm's members ── */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.users.getByFirm(user.firmId, (localStorage.getItem('userRole') || 'firmadmin').toLowerCase());
      setUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(`Could not load users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user?.firmId]);

  useEffect(() => { load(); }, [load]);

  /* ── Filter + paginate ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const okSearch = !q || `${u.fullName || u.name} ${u.email}`.toLowerCase().includes(q);
      const okRole = roleFilter === 'all' || u.role === roleFilter;
      return okSearch && okRole;
    });
  }, [users, search, roleFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  /* Headline stats (zero-padded like the vanilla design). */
  const total = users.length;
  const lawyers = users.filter((u) => u.role === 'lawyer' && u.accountStatus !== 'inactive').length;
  const clients = users.filter((u) => u.role === 'client' && u.accountStatus !== 'inactive').length;

  /* ── Save (create or update) ── */
  const saveUser = async () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.role) {
      toast('Name, email and role are required.', 'error');
      return;
    }
    setBusy(true);
    try {
      if (form.id) {
        await api.users.update(form.id, {
          fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone || '',
          role: form.role, accountStatus: form.accountStatus, availability: form.availability, firmId: user.firmId,
        }, 'firmadmin');
        toast('User updated successfully.');
      } else {
        await api.users.create({
          fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone || '',
          role: form.role, accountStatus: form.accountStatus, availability: form.availability,
          firmId: user.firmId, password: 'changeme123', // default password, like vanilla
        }, 'firmadmin');
        toast('User created successfully.');
      }
      setForm(null);
      load();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  /* ── Delete ── */
  const deleteUser = async (u) => {
    if (!window.confirm(`Are you sure you want to remove ${u.fullName || u.name}?`)) return;
    try {
      await api.users.remove(u.id, 'firmadmin');
      toast('User removed successfully.');
      load();
    } catch (err) {
      toast(`Delete failed: ${err.message}`, 'error');
    }
  };

  /* Export the current list as a JSON file download. */
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(users, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firm_users.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle="Invite and manage the members of your firm."
        actions={<Button onClick={() => { setForm({ fullName: '', email: '', phone: '', role: 'lawyer', accountStatus: 'active', availability: 'available' }); }}>
          <Icon name="plus" size={14} /> Add New User
        </Button>}
      />

      {/* stats row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[['Total Users', total], ['Active Lawyers', lawyers], ['Active Clients', clients]].map(([label, n]) => (
          <Card key={label} className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{String(n).padStart(3, '0')}</p>
          </Card>
        ))}
      </div>

      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="!pl-9" placeholder="Search users..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="!w-44">
          <option value="all">All Roles</option>
          {['firmadmin', 'lawyer', 'client', 'intern'].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </Select>
        <Button variant="outline" onClick={exportJson} title="Export users JSON">
          <Icon name="download" size={14} /> Export
        </Button>
      </div>

      {loading && <Loading text="Loading users…" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && visible.length === 0 && <EmptyState icon="users" title="No users match your filters." />}

      {!loading && !error && visible.length > 0 && (
        <Card>
          <Table>
            <thead>
              <tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Actions</Th></tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <Td>
                    <span className="flex items-center gap-3">
                      <Avatar name={u.fullName || u.name} />
                      <span>
                        <span className="block font-semibold text-slate-800">{u.fullName || u.name}</span>
                        <span className="block text-xs text-slate-400">ID: {u.id}</span>
                      </span>
                    </span>
                  </Td>
                  <Td>{u.email}</Td>
                  <Td><Badge variant={roleTone[u.role] || 'slate'}>{roleLabel(u.role)}</Badge></Td>
                  <Td>
                    <span className="flex items-center gap-2 text-xs">
                      <span className={`h-2 w-2 rounded-full ${u.availability !== 'unavailable' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {u.availability === 'unavailable' ? 'Unavailable' : 'Available'}
                      <Badge variant={u.accountStatus === 'inactive' ? 'red' : 'green'}>{u.accountStatus || 'Active'}</Badge>
                    </span>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <button title="Edit" aria-label="Edit user" onClick={() => setForm({
                        id: u.id, fullName: u.fullName || u.name || '', email: u.email || '', phone: u.phone || '',
                        role: u.role, accountStatus: u.accountStatus || 'active', availability: u.availability || 'available',
                      })}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
                        <Icon name="edit" size={14} />
                      </button>
                      <button title="Delete" aria-label="Delete user" onClick={() => deleteUser(u)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="px-4 pb-4">
            <Pagination page={safePage} pages={pages} total={filtered.length} perPage={PER_PAGE} onPage={setPage} />
          </div>
        </Card>
      )}

      {/* ── Add/Edit modal ── */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit User' : 'Add New User'}
        subtitle={form?.id ? 'Update this member\'s details.' : 'They can change their password after first login.'}
        footer={<>
          <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          <Button loading={busy} onClick={saveUser}>{form?.id ? 'Save Changes' : 'Create User'}</Button>
        </>}>
        {form && (
          <div className="space-y-4">
            <Field label="Full Name" required>
              <Input value={form.fullName} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={form.email} maxLength={120} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} maxLength={16} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
            {/* Firm Admin option only appears when editing an actual admin (vanilla rule) */}
            <Field label="Role" required>
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {['lawyer', 'intern', 'client', ...(form.id && form.role === 'firmadmin' ? ['firmadmin'] : [])].map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </Select>
            </Field>
            {/* account status + availability toggles */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Account Status">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                  {['active', 'inactive'].map((s) => (
                    <button type="button" key={s} onClick={() => setForm((f) => ({ ...f, accountStatus: s }))}
                      className={`rounded-md py-1.5 text-xs font-semibold capitalize ${form.accountStatus === s ? 'bg-white text-brand shadow-sm' : 'text-slate-500'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Availability">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                  {['available', 'unavailable'].map((s) => (
                    <button type="button" key={s} onClick={() => setForm((f) => ({ ...f, availability: s }))}
                      className={`rounded-md py-1.5 text-xs font-semibold capitalize ${form.availability === s ? 'bg-white text-brand shadow-sm' : 'text-slate-500'}`}>
                      {s === 'unavailable' ? 'Not avail.' : s}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}