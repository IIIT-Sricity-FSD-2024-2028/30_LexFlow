/**
 * Superadmin - Users: every account in any role, with full CRUD
 * (password field only when creating).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import {
  Button, Card, Badge, PageHeader, Loading, ErrorBanner,
  Modal, Field, Input, Select, Table, Th, Td,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { initials, roleLabel, formatDate } from '../../lib/format.js';

const ROLES = ['client', 'lawyer', 'intern', 'firmadmin', 'superadmin'];
const roleTone = { firmadmin: 'purple', superadmin: 'purple', lawyer: 'blue', intern: 'slate', client: 'green' };

export default function SAUsers() {
  const { toast } = useApp();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.users.getAll({}, 'superadmin');
      setUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const okSearch = !q || `${u.fullName || u.name} ${u.email} ${u.id} ${u.firmId}`.toLowerCase().includes(q);
      const okRole = roleFilter === 'all' || u.role === roleFilter;
      return okSearch && okRole;
    });
  }, [users, search, roleFilter]);

  const saveUser = async () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.role) {
      toast('Name, email and role are required.', 'error');
      return;
    }
    setBusy(true);
    try {
      if (form.id) {
        const { password, id, ...body } = form; // never send a password on edit
        await api.users.update(id, body);
        toast('User updated.');
      } else {
        const { id, ...body } = form;
        await api.users.create(body);
        toast('User created.');
      }
      setForm(null);
      load();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete ${u.fullName || u.name}?`)) return;
    try {
      await api.users.remove(u.id, 'superadmin');
      toast('User deleted.');
      load();
    } catch (err) {
      toast(err.message || 'Delete failed', 'error');
    }
  };

  if (loading) return <Loading text="Loading users…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="All accounts in every role."
        actions={<Button onClick={() => setForm({ fullName: '', email: '', phone: '', role: 'client', firmId: '', accountStatus: 'active', password: '' })}>
          <Icon name="plus" size={14} /> Add user
        </Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search name, email, ID or firm…" value={search} onChange={(e) => setSearch(e.target.value)} className="!w-72" />
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="!w-40">
          <option value="all">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </Select>
        <span className="text-xs font-semibold text-slate-400">{filtered.length} of {users.length} users</span>
      </div>

      <Card>
        <Table>
          <thead>
            <tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Firm</Th><Th>Status</Th><Th>Joined</Th><Th>Actions</Th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No users match your filters.</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <Td>
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{initials(u.fullName || u.name)}</span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{u.fullName || u.name}</span>
                      <span className="block font-mono text-[10px] text-slate-400">{u.id}</span>
                    </span>
                  </span>
                </Td>
                <Td>{u.email}</Td>
                <Td><Badge variant={roleTone[u.role] || 'slate'}>{roleLabel(u.role)}</Badge></Td>
                <Td className="font-mono text-xs">{u.firmId || '—'}</Td>
                <Td><Badge variant={(u.accountStatus || 'active') === 'active' ? 'green' : 'red'}>{u.accountStatus || 'active'}</Badge></Td>
                <Td className="text-xs">{formatDate(u.createdAt)}</Td>
                <Td>
                  <div className="flex gap-1">
                    <button title="Edit" aria-label="Edit user" onClick={() => setForm({
                      id: u.id, fullName: u.fullName || u.name || '', email: u.email || '', phone: u.phone || '',
                      role: u.role, firmId: u.firmId || '', accountStatus: u.accountStatus || 'active', password: '',
                    })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><Icon name="edit" size={14} /></button>
                    <button title="Delete" aria-label="Delete user" onClick={() => deleteUser(u)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Icon name="trash" size={14} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* add/edit modal */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit user' : 'Add user'}
        footer={<>
          <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          <Button loading={busy} onClick={saveUser}>Save</Button>
        </>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Role" required>
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </Select>
            </Field>
            <Field label="Firm ID"><Input value={form.firmId} onChange={(e) => setForm((f) => ({ ...f, firmId: e.target.value }))} /></Field>
            <Field label="Account status">
              <Select value={form.accountStatus} onChange={(e) => setForm((f) => ({ ...f, accountStatus: e.target.value }))}>
                {['active', 'inactive'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            {/* password only when creating a new account */}
            {!form.id && (
              <Field label="Password (optional)" className="sm:col-span-2">
                <Input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="leave empty to auto-generate" />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}