/**
 * Tasks page (firm + lawyer) - full task CRUD with search, filters,
 * pagination (5 per page) and a create/edit modal + a view modal.
 * Lawyers only see tasks assigned to them (that was the vanilla
 * lawyer-tasks.js behaviour; the vanilla firm page saw all firm tasks).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import {
  Button, Card, Badge, PageHeader, Loading, ErrorBanner, EmptyState,
  Modal, Field, Input, Select, Textarea, FilterDropdown, Pagination, Table, Th, Td, Avatar,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

const PER_PAGE = 5;

export default function FirmTasks() {
  const { user, toast } = useApp();
  const role = (user?.role || 'firmadmin').toLowerCase();
  const isLawyer = role === 'lawyer';

  /* ── Data ── */
  const [tasks, setTasks] = useState([]);
  const [cases, setCases] = useState([]);        // to resolve "Case ID/CNR" inputs
  const [members, setMembers] = useState([]);    // possible assignees
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* ── Toolbar state ── */
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);

  /* ── Modals ── */
  const [form, setForm] = useState(null);        // create/edit modal data
  const [viewing, setViewing] = useState(null);  // view modal data
  const [errors, setErrors] = useState({});

  /* ── Load everything this page needs ── */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const taskFilters = isLawyer
        ? { assignedUser: user.fullName || user.name, firmId: user?.firmId }
        : { firmId: user?.firmId };
      const [t, c, m] = await Promise.all([
        api.tasks.getAll(taskFilters, role),
        api.cases.getAll(user?.firmId ? { firmId: user.firmId } : {}, role),
        api.users.getLawyers(user?.firmId, role).catch(() => []),
      ]);
      setTasks(Array.isArray(t) ? t : []);
      setCases(Array.isArray(c) ? c : []);
      setMembers(Array.isArray(m) ? m : []);
    } catch (err) {
      setError(`Could not load tasks: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [role, isLawyer, user?.firmId, user?.fullName, user?.name]);

  useEffect(() => { load(); }, [load]);

  /* ── Filtering + pagination (client-side) ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tasks.filter((t) => {
      const okSearch = !q || `${t.name} ${t.caseTitle} ${t.id}`.toLowerCase().includes(q);
      const okPriority = priorityFilter === 'All' || t.priority === priorityFilter;
      const okStatus = statusFilter === 'All' || t.status === statusFilter;
      return okSearch && okPriority && okStatus;
    });
  }, [tasks, search, priorityFilter, statusFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  /* The case whose id / cnr / title matches the text typed in the modal. */
  const resolveCase = (input) =>
    cases.find((c) =>
      String(c.id) === String(input) || c.cnr === input ||
      (c.case_type || c.title || '').toLowerCase() === String(input || '').toLowerCase()
    );

  /* ── CRUD handlers ── */

  /* Create or update, depending on whether form has an id. */
  const saveTask = async () => {
    const er = {
      name: form.name.trim() ? null : 'Task name is required',
      caseInput: form.caseInput.trim() ? null : 'Case ID/CNR is required',
      dueDate: form.dueDate ? null : 'Due date is required',
    };
    setErrors(er);
    if (Object.values(er).some(Boolean)) return;

    const resolved = resolveCase(form.caseInput.trim());
    const payload = {
      name: form.name.trim(),
      caseTitle: form.caseInput.trim(),
      assignedUser: form.assignee,
      priority: form.priority,
      dueDate: form.dueDate,
      description: form.description || '',
      caseId: resolved ? String(resolved.id) : '',
      caseCnr: resolved ? (resolved.cnr || '') : '',
      firmId: user?.firmId || 'firm-1',
    };
    try {
      if (form.id) {
        await api.tasks.update(form.id, payload, role);   // edit
        toast('Task updated.');
      } else {
        await api.tasks.create(payload, role);            // create
        toast('Task created.');
      }
      setForm(null);
      load();
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    }
  };

  /* Mark a task completed (from the row menu or the view modal). */
  const completeTask = async (id) => {
    try {
      await api.tasks.update(id, { status: 'Completed' }, role);
      toast('Task marked as completed.');
      setViewing(null);
      load();
    } catch (err) {
      toast(`Failed: ${err.message}`, 'error');
    }
  };

  /* Delete a task after confirmation. */
  const deleteTask = async (t) => {
    if (!window.confirm(`Are you sure you want to delete task ${t.id}?`)) return;
    try {
      await api.tasks.remove(t.id, role);
      toast('Task deleted.');
      load();
    } catch (err) {
      toast(`Delete failed: ${err.message}`, 'error');
    }
  };

  return (
    <>
      <PageHeader
        title={isLawyer ? 'My Tasks' : 'Firm Tasks'}
        subtitle={isLawyer ? 'Monitor and manage all your assigned legal responsibilities.' : 'Create, assign and track tasks across the firm.'}
        actions={<Button onClick={() => { setErrors({}); setForm({ name: '', caseInput: '', assignee: '', priority: 'LOW', dueDate: '', description: '' }); }}>
          <Icon name="plus" size={14} /> New Task
        </Button>}
      />

      {/* toolbar: search + filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="!pl-9" placeholder="Search by name or case..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <FilterDropdown>
          <div className="space-y-3">
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              {['All', 'HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p}>{p}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {['All', 'Pending', 'Completed'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
        </FilterDropdown>
      </div>

      {loading && <Loading text="Loading tasks…" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && (
        <Card>
          <Table>
            <thead>
              <tr><Th>Task Name</Th><Th>Task ID</Th><Th>Assigned To</Th><Th>Priority</Th><Th>Due Date</Th><Th>Status</Th><Th>Actions</Th></tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><Td colSpan={7} className="!text-center text-slate-400">No tasks found.</Td></tr>
              ) : visible.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Td>
                    <p className="font-semibold text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.caseTitle || 'General'}</p>
                  </Td>
                  <Td className="font-mono text-xs">{t.id}</Td>
                  <Td>
                    <span className={`flex items-center gap-2 ${t.status === 'Completed' ? 'opacity-50' : ''}`}>
                      <Avatar name={t.assignedUser || 'Unassigned'} className="h-7 w-7" />
                      {t.assignedUser || 'Unassigned'}
                    </span>
                  </Td>
                  <Td>
                    <Badge variant={t.priority === 'HIGH' ? 'red' : t.priority === 'MEDIUM' ? 'amber' : 'green'}>
                      {t.priority}
                    </Badge>
                  </Td>
                  <Td>{fmtDate(t.dueDate)}</Td>
                  <Td>
                    {t.status === 'Completed'
                      ? <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Icon name="check" size={13} /> Completed</span>
                      : <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600"><Icon name="clock" size={13} /> Pending</span>}
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <IconBtn icon="eye" title="View" onClick={() => setViewing(t)} />
                      <IconBtn icon="edit" title="Edit" onClick={() => openEdit(t)} />
                      <IconBtn icon="trash" title="Delete" danger onClick={() => deleteTask(t)} />
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

      {/* ── Create / Edit modal ── */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit Task' : 'Create Task'}
        footer={<>
          <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          <Button onClick={saveTask}>{form?.id ? 'Save Changes' : 'Create Task'}</Button>
        </>}>
        {form && (
          <div className="space-y-4">
            <Field label="Task Name" required error={errors.name}>
              <Input value={form.name} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={!!errors.name} />
            </Field>
            <Field label="Case ID / CNR" required error={errors.caseInput}>
              <Input value={form.caseInput} maxLength={30} placeholder="Type a case id, CNR or title"
                onChange={(e) => setForm((f) => ({ ...f, caseInput: e.target.value }))} error={!!errors.caseInput} />
              {resolveCase(form.caseInput.trim()) && (
                <span className="mt-1 block text-xs font-medium text-emerald-600">
                  Matched: {resolveCase(form.caseInput.trim()).case_type || resolveCase(form.caseInput.trim()).title}
                </span>
              )}
            </Field>
            <Field label="Assignee">
              {/* If the typed case has a team, offer just those members (vanilla rule). */}
              <Select value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}>
                <option value="">Select…</option>
                {(resolveCase(form.caseInput.trim())?.team?.length
                  ? resolveCase(form.caseInput.trim()).team.map((m) => m.name)
                  : members.map((m) => m.fullName || m.name)
                ).map((name) => <option key={name} value={name}>{name}</option>)}
              </Select>
            </Field>
            {/* priority segmented toggle */}
            <Field label="Priority">
              <div className="grid grid-cols-3 gap-2">
                {['LOW', 'MEDIUM', 'HIGH'].map((p) => (
                  <button type="button" key={p} onClick={() => setForm((f) => ({ ...f, priority: p }))}
                    className={`rounded-lg border py-2 text-xs font-bold transition
                      ${form.priority === p ? 'border-brand bg-brand text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Due Date" required error={errors.dueDate}>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} error={!!errors.dueDate} />
            </Field>
            <Field label="Description">
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
          </div>
        )}
      </Modal>

      {/* ── View modal ── */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name || 'Task'}
        subtitle={viewing ? `Task ${viewing.id}` : ''}
        footer={<>
          <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
          <Button disabled={viewing?.status === 'Completed'} onClick={() => completeTask(viewing.id)}>
            {viewing?.status === 'Completed' ? 'Completed' : 'Mark as Completed'}
          </Button>
        </>}>
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-3">
              <Badge variant={prioTone(viewing.priority)}>{viewing.priority}</Badge>
              <Badge variant={viewing.status === 'Completed' ? 'green' : 'amber'}>{viewing.status}</Badge>
              <Badge>Due {fmtDate(viewing.dueDate)}</Badge>
            </div>
            {viewing.description && <p className="rounded-lg bg-slate-50 p-3 text-[13px] text-slate-600">{viewing.description}</p>}
            <div className="flex items-center gap-3">
              <Avatar name={viewing.assignedUser || 'Unassigned'} />
              <div>
                <p className="font-semibold text-slate-800">{viewing.assignedUser || 'Unassigned'}</p>
                <p className="text-xs text-slate-400">Assignee</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );

  /* Prefill the edit modal (converting the due date back to YYYY-MM-DD). */
  function openEdit(t) {
    setViewing(null);
    setErrors({});
    let iso = '';
    const d = new Date(t.dueDate);
    if (!isNaN(d)) iso = d.toISOString().split('T')[0];
    setForm({
      id: t.id, name: t.name || '', caseInput: t.caseTitle || '', assignee: t.assignedUser || '',
      priority: t.priority || 'MEDIUM', dueDate: iso, description: t.description || '',
    });
  }
}

/* Tiny icon-only action button used in table rows. */
function IconBtn({ icon, title, danger = false, onClick }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className={`rounded-lg p-1.5 hover:bg-slate-100 ${danger ? 'text-slate-400 hover:text-red-500' : 'text-slate-400 hover:text-indigo-600'}`}>
      <Icon name={icon} size={14} />
    </button>
  );
}

function prioTone(p) {
  return p === 'HIGH' ? 'red' : p === 'MEDIUM' ? 'amber' : 'green';
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}