/**
 * Case Details (firm + lawyer) - the richest page in the app.
 * Sections: header (edit), client details,
 * pending tasks, document management.
 * Modals: edit case, edit client, add task, upload document.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { useDispatch } from 'react-redux';
import { caseSaved } from '../../store/slices/mattersSlice.js';
import { navigate } from '../../router.jsx';
import { Breadcrumb } from '../../components/Layout.jsx';
import {
  Button, Card, Badge, StatusBadge, PageHeader, Loading, ErrorBanner,
  Modal, Field, Input, Select,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { formatDate } from '../../lib/format.js';

export default function FirmCaseDetails({ id }) {
  const { user, toast } = useApp();
  const dispatch = useDispatch();
  const role = (user?.role || 'firmadmin').toLowerCase();

  /* ── Page data ── */
  const [caseData, setCaseData] = useState(null);   // the case itself
  const [tasks, setTasks] = useState([]);           // tasks attached to this case
  const [firmMembers, setFirmMembers] = useState([]); // for the assignee dropdown
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* ── Modal state (null = closed) ── */
  const [editCase, setEditCase] = useState(null);       // edit case details form
  const [editClient, setEditClient] = useState(null);   // edit client details form
  const [addTask, setAddTask] = useState(null);         // new task form
  const [modalErrors, setModalErrors] = useState({});   // per-modal validation errors

  /* ── Tab state ('overview' | 'timeline') ── */
  const [activeTab, setActiveTab] = useState('overview');

  /* ── Editable Progress and Timeline state ── */
  const [progressInput, setProgressInput] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);
  const [timelineModal, setTimelineModal] = useState(null); // { index, title, date, note, upcoming }
  const [savingTimeline, setSavingTimeline] = useState(false);

  /* ── Load the case + related data ── */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Try the direct lookup first (?id= in the URL).
      let data = null;
      try {
        data = await api.cases.getById(id, role);
      } catch {
        // Fallback: the URL may carry a CNR instead of an id.
        const all = await api.cases.getAll(user?.firmId ? { firmId: user.firmId } : {}, role);
        data = (Array.isArray(all) ? all : []).find((c) => c.cnr === id || String(c.id) === id);
      }
      if (!data) throw new Error('Case not found');

      // The case only holds ids, so look up the law firm and lawyer names.
      const [firms, lawyer, clientUser] = await Promise.all([
        api.users.getAllFirms(role).catch(() => []),
        data.lawyer_id ? api.users.getById(data.lawyer_id, role).catch(() => null) : null,
        data.client_id ? api.users.getById(data.client_id, role).catch(() => null) : null,
      ]);
      data.clientUser = clientUser; // the client's real account (name, email, phone)
      data.firmName = (Array.isArray(firms) ? firms : []).find((f) => f.id === data.lawfirm_id)?.name;
      data.lawyerName = lawyer?.fullName || lawyer?.name;

      setCaseData(data);

      // Tasks belonging to this case.
      try {
        const t = await api.tasks.getAll({ caseId: data.id, firmId: user?.firmId }, role);
        setTasks(Array.isArray(t) ? t : []);
      } catch { setTasks([]); }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, role, user?.firmId, user?.email]);

  useEffect(() => { load(); }, [load]);

  /* Firm members for the assignee dropdown. Firm admins can assign to lawyers
     and interns; a lawyer can assign only to interns. */
  useEffect(() => {
    const assignable = role === 'lawyer' ? ['intern'] : ['lawyer', 'intern'];
    api.users.getByFirm(user?.firmId, role)
      .then((l) => setFirmMembers((Array.isArray(l) ? l : []).filter((u) => assignable.includes(u.role))))
      .catch(() => {});
  }, [role, user?.firmId]);

  useEffect(() => {
    if (caseData?.progress !== undefined && caseData?.progress !== null) {
      setProgressInput(caseData.progress);
    }
  }, [caseData?.progress]);

  /* ── Derived values ── */
  const pendingTasks = (tasks || []).filter((t) => t.status !== 'Completed' && String(t.caseId) === String(caseData?.id));
  const client = caseData?.client || {};

  /* PATCH helper. The API rejects unknown fields (forbidNonWhitelisted) and documents
     have their own endpoint, so send only the fields UpdateCaseDto allows. */
  const saveCase = async (updated) => {
    const body = {};
    for (const k of ['consultation_id', 'lawfirm_id', 'client_id', 'cnr', 'case_type',
      'brief_description', 'status', 'client', 'filed_date', 'progress', 'timeline']) {
      if (updated[k] !== undefined && updated[k] !== null) body[k] = updated[k];
    }
    const saved = await api.cases.update(updated.id, body, role);
    setCaseData((c) => ({ ...c, ...saved, ...body }));
    dispatch(caseSaved({ id: updated.id, ...body, ...saved }));
    return saved;
  };

  /* Guard renders while loading / on error. */
  if (loading) return <Loading text="Loading case…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!caseData) return null;

  const title = caseData.case_type || caseData.title || 'Case';

  return (
    <>
      <Breadcrumb items={[{ label: 'Cases', href: '/firm/cases' }, { label: `Case #${caseData.cnr || caseData.id}` }]} />

      {/* ── Header card with status + edit/export buttons ── */}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <StatusBadge status={caseData.status || 'Ongoing'} />
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{caseData.brief_description || title}</h1>
          <p className="text-sm text-slate-500">{title} | CNR: {caseData.cnr || '—'} | Opened: {formatDate(caseData.filed_date || caseData.filedDate)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setModalErrors({}); setEditCase({ title, status: caseData.status || 'Ongoing' }); }}>
            Edit Details
          </Button>
          <Button variant="outline" onClick={() => navigate(`/documents/${caseData.id}`)}>
            <Icon name="document" size={14} /> Manage Documents
          </Button>
          <Button variant="outline" onClick={() => exportCSV(caseData)}>
            <Icon name="download" size={14} /> Export
          </Button>
        </div>
      </Card>

      {/* ── Tabs navigation ── */}
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === 'overview'
              ? 'border-brand font-bold text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === 'timeline'
              ? 'border-brand font-bold text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Timeline & Case Progress
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ════════ LEFT COLUMN ════════ */}
          <div className="space-y-6">
            {/* client details card */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Client Details</h2>
                <button className="text-xs font-semibold text-indigo-600 hover:underline"
                  onClick={() => { setModalErrors({}); setEditClient({ opposingParty: client.opposingParty || '' }); }}>
                  Edit
                </button>
              </div>
              {/* name / email / phone come from the client's real account */}
              <InfoRow label="Client" value={caseData.clientUser?.fullName || '—'} />
              <InfoRow label="Email" value={caseData.clientUser?.email || '—'} />
              <InfoRow label="Phone" value={caseData.clientUser?.phone || '—'} />
              <InfoRow label="Address" value={caseData.clientUser?.address || '—'} />
              <InfoRow label="Account Type" value={caseData.clientUser?.accountType || '—'} />
              <InfoRow label="Opposing Party" value={client.opposingParty || 'Not added yet'} />
            </Card>

            {/* pending tasks card */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-bold text-slate-900">
                  Pending Tasks <Badge variant="amber">{pendingTasks.length}</Badge>
                </h2>
                <button className="text-xs font-semibold text-indigo-600 hover:underline"
                  onClick={() => { setModalErrors({}); setAddTask({ name: '', assignee: '', priority: 'MEDIUM', dueDate: '' }); }}>
                  + Assign New Task
                </button>
              </div>
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-slate-400">No pending tasks.</p>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.map((t) => (
                    <label key={t.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                      {/* ticking the checkbox completes the task */}
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" onChange={() => completeTask(t.id)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{t.name}</p>
                        <p className="text-xs text-slate-400">Due {fmtDate(t.dueDate)}</p>
                      </div>
                      <Badge variant={t.priority === 'HIGH' ? 'red' : 'green'}>{t.priority}</Badge>
                    </label>
                  ))}
                </div>
              )}
              <Button variant="outline" className="mt-4 w-full !text-xs" onClick={() => navigate(`/firm/tasks/${caseData.id}`)}>
                View All Tasks
              </Button>
            </Card>
          </div>

          {/* ════════ RIGHT COLUMN ════════ */}
          <div className="space-y-6 lg:col-span-2">
            {/* case information card */}
            <Card className="p-6">
              <h2 className="mb-4 font-bold text-slate-900">Case Information</h2>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <InfoRow label="CNR Number" value={caseData.cnr || '—'} />
                <InfoRow label="Case Type" value={title} />
                <InfoRow label="Status" value={caseData.status || 'Ongoing'} />
                <InfoRow label="Filed Date" value={formatDate(caseData.filed_date || caseData.filedDate)} />
                <InfoRow label="Law Firm" value={caseData.firmName || '—'} />
                <InfoRow label="Assigned Lawyer" value={caseData.lawyerName || 'Not assigned yet'} />
              </div>
              <InfoRow label="Description" value={caseData.brief_description || '—'} />
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Progress Card (Left Column) */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="font-bold text-slate-900">Case Progress</h2>
              <p className="mt-2 text-3xl font-extrabold text-brand">
                {caseData.progress || 0}% <span className="text-sm font-medium text-slate-500">Complete</span>
              </p>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, caseData.progress || 0))}%` }}
                />
              </div>

              {/* Editable parts */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Update Progress</p>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={progressInput}
                      onChange={(e) => setProgressInput(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-brand"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={progressInput}
                        onChange={(e) => setProgressInput(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                        className="w-14 rounded-md border border-slate-300 px-2 py-1 text-center text-xs font-bold text-slate-800"
                      />
                      <span className="text-xs font-bold text-slate-500">%</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[0, 25, 50, 75, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setProgressInput(preset)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                          progressInput === preset
                            ? 'border-brand bg-brand text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>

                  <Button
                    loading={savingProgress}
                    onClick={handleSaveProgress}
                    className="w-full !py-1.5 !text-xs"
                  >
                    Save Progress
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Timeline Card (Right Column, lg:col-span-2) */}
          <div className="space-y-6 lg:col-span-2">
            <Card className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">Timeline</h2>
                  <p className="text-xs text-slate-500">Milestones and key dates for this case.</p>
                </div>
                <Button
                  onClick={() => {
                    setModalErrors({});
                    setTimelineModal({
                      index: -1,
                      title: '',
                      date: formatDate(new Date().toISOString()),
                      note: '',
                      upcoming: false,
                    });
                  }}
                  className="!py-1.5 !text-xs"
                >
                  <Icon name="plus" size={14} /> Add Event
                </Button>
              </div>

              {(caseData.timeline || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
                  <p className="text-sm text-slate-400">No timeline events recorded.</p>
                  <Button
                    variant="outline"
                    className="mt-3 !text-xs"
                    onClick={() => {
                      setModalErrors({});
                      setTimelineModal({
                        index: -1,
                        title: '',
                        date: formatDate(new Date().toISOString()),
                        note: '',
                        upcoming: false,
                      });
                    }}
                  >
                    + Add First Event
                  </Button>
                </div>
              ) : (
                <ol className="relative space-y-5 border-l-2 border-slate-100 pl-5">
                  {(caseData.timeline || []).map((t, i) => (
                    <li key={i} className="group relative">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand shadow-sm" />
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-sm font-bold ${t.grey ? 'text-slate-400' : 'text-slate-800'}`}>{t.title}</p>
                            {t.upcoming && <Badge variant="amber">UPCOMING</Badge>}
                          </div>
                          <p className="text-xs text-slate-400">{t.date}</p>
                          {(t.note || t.description) && (
                            <p className="mt-1 text-xs text-slate-600">{t.note || t.description}</p>
                          )}
                        </div>

                        {/* Editable actions */}
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            title="Edit Event"
                            onClick={() => {
                              setModalErrors({});
                              setTimelineModal({
                                index: i,
                                title: t.title || '',
                                date: t.date || '',
                                note: t.note || t.description || '',
                                upcoming: !!t.upcoming,
                              });
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            type="button"
                            title="Delete Event"
                            onClick={() => handleDeleteTimelineEvent(i)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════ MODALS ══════════════ */}

      {/* Edit case details */}
      <Modal open={!!editCase} onClose={() => setEditCase(null)} title="Edit Case Details"
        footer={<>
          <Button variant="ghost" onClick={() => setEditCase(null)}>Cancel</Button>
          <Button onClick={saveCaseModal}>Save Changes</Button>
        </>}>
        {editCase && (
          <div className="space-y-4">
            <Field label="Case Title" required error={modalErrors.title}>
              <Input value={editCase.title} maxLength={200}
                onChange={(e) => setEditCase((c) => ({ ...c, title: e.target.value }))} error={!!modalErrors.title} />
            </Field>
            <Field label="Status">
              <Select value={editCase.status} onChange={(e) => setEditCase((c) => ({ ...c, status: e.target.value }))}>
                {['Active', 'Ongoing', 'Closed'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      {/* Edit client details */}
      <Modal open={!!editClient} onClose={() => setEditClient(null)} title="Edit Client Details"
        footer={<>
          <Button variant="ghost" onClick={() => setEditClient(null)}>Cancel</Button>
          <Button onClick={saveClientModal}>Save</Button>
        </>}>
        {editClient && (
          <div className="space-y-4">
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Name, email, phone, address and account type come from the client's account and can't be edited here.
            </p>
            <Field label="Opposing Party" error={modalErrors.opposingParty}>
              <Input value={editClient.opposingParty} maxLength={150} onChange={(e) => setEditClient((c) => ({ ...c, opposingParty: e.target.value }))} error={!!modalErrors.opposingParty} />
            </Field>
          </div>
        )}
      </Modal>

      {/* Assign new task */}
      <Modal open={!!addTask} onClose={() => setAddTask(null)} title="Assign New Task"
        footer={<>
          <Button variant="ghost" onClick={() => setAddTask(null)}>Cancel</Button>
          <Button onClick={saveNewTask}>Create Task</Button>
        </>}>
        {addTask && (
          <div className="space-y-4">
            <Field label="Task Name" required error={modalErrors.name}>
              <Input value={addTask.name} maxLength={200}
                onChange={(e) => setAddTask((t) => ({ ...t, name: e.target.value }))} error={!!modalErrors.name} />
            </Field>
            <Field label="Assignee">
              <Select value={addTask.assignee} onChange={(e) => setAddTask((t) => ({ ...t, assignee: e.target.value }))}>
                <option value="">Select…</option>
                {firmMembers.map((u) => <option key={u.id} value={u.fullName || u.name}>{u.fullName || u.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Priority">
                <Select value={addTask.priority} onChange={(e) => setAddTask((t) => ({ ...t, priority: e.target.value }))}>
                  {['HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Due Date" required error={modalErrors.dueDate}>
                <Input type="date" value={addTask.dueDate}
                  onChange={(e) => setAddTask((t) => ({ ...t, dueDate: e.target.value }))} error={!!modalErrors.dueDate} />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add / Edit Timeline Event Modal ── */}
      <Modal open={!!timelineModal} onClose={() => setTimelineModal(null)}
        title={timelineModal?.index >= 0 ? 'Edit Timeline Event' : 'Add Timeline Event'}
        footer={<>
          <Button variant="ghost" onClick={() => setTimelineModal(null)}>Cancel</Button>
          <Button loading={savingTimeline} onClick={handleSaveTimelineModal}>
            {timelineModal?.index >= 0 ? 'Save Changes' : 'Add Event'}
          </Button>
        </>}>
        {timelineModal && (
          <div className="space-y-4">
            <Field label="Event Title" required error={modalErrors.eventTitle}>
              <Input placeholder="e.g. Chargesheet Submitted, Bail Hearing, Plaint Filed..."
                value={timelineModal.title} maxLength={200}
                onChange={(e) => setTimelineModal((m) => ({ ...m, title: e.target.value }))}
                error={!!modalErrors.eventTitle} />
            </Field>

            <Field label="Event Date" required error={modalErrors.eventDate}>
              <div className="flex gap-2">
                <Input placeholder="e.g. 15 Jan 2026"
                  value={timelineModal.date}
                  onChange={(e) => setTimelineModal((m) => ({ ...m, date: e.target.value }))}
                  error={!!modalErrors.eventDate}
                  className="flex-1" />
                <Button type="button" variant="outline" className="!text-xs whitespace-nowrap"
                  onClick={() => setTimelineModal((m) => ({ ...m, date: formatDate(new Date().toISOString()) }))}>
                  Today
                </Button>
              </div>
            </Field>

            <Field label="Notes / Description">
              <Input placeholder="Brief details or observations about this milestone..."
                value={timelineModal.note} maxLength={300}
                onChange={(e) => setTimelineModal((m) => ({ ...m, note: e.target.value }))} />
            </Field>

            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer">
              <input type="checkbox" checked={timelineModal.upcoming}
                onChange={(e) => setTimelineModal((m) => ({ ...m, upcoming: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
              <div>
                <p className="text-xs font-bold text-slate-800">Mark as Upcoming Milestone</p>
                <p className="text-[11px] text-slate-500">Displays an 'UPCOMING' badge on this milestone</p>
              </div>
            </label>
          </div>
        )}
      </Modal>

    </>
  );

  /* ══════════════ ACTION HANDLERS (defined after JSX, hoisted functions) ══════════════ */

  /* Handle saving progress percentage */
  async function handleSaveProgress() {
    setSavingProgress(true);
    try {
      const val = Math.min(100, Math.max(0, Number(progressInput) || 0));
      await saveCase({ ...caseData, progress: val });
      toast('Case progress updated successfully.');
    } catch (err) {
      toast(`Failed to update progress: ${err.message}`, 'error');
    } finally {
      setSavingProgress(false);
    }
  }

  /* Handle saving timeline event from modal */
  async function handleSaveTimelineModal() {
    const errs = {
      eventTitle: timelineModal.title.trim() ? null : 'Event title is required',
      eventDate: timelineModal.date.trim() ? null : 'Event date is required',
    };
    setModalErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setSavingTimeline(true);
    try {
      const eventObj = {
        title: timelineModal.title.trim(),
        date: timelineModal.date.trim(),
        note: timelineModal.note.trim(),
        description: timelineModal.note.trim(),
        upcoming: !!timelineModal.upcoming,
      };

      const currentTimeline = [...(caseData.timeline || [])];
      if (timelineModal.index >= 0) {
        currentTimeline[timelineModal.index] = { ...currentTimeline[timelineModal.index], ...eventObj };
      } else {
        currentTimeline.push(eventObj);
      }

      await saveCase({ ...caseData, timeline: currentTimeline });
      toast(timelineModal.index >= 0 ? 'Timeline event updated.' : 'Timeline event added.');
      setTimelineModal(null);
    } catch (err) {
      toast(`Failed to save event: ${err.message}`, 'error');
    } finally {
      setSavingTimeline(false);
    }
  }

  /* Handle deleting timeline event */
  async function handleDeleteTimelineEvent(index) {
    if (!window.confirm('Delete this timeline event?')) return;
    try {
      const currentTimeline = (caseData.timeline || []).filter((_, i) => i !== index);
      await saveCase({ ...caseData, timeline: currentTimeline });
      toast('Timeline event deleted.');
    } catch (err) {
      toast(`Failed to delete event: ${err.message}`, 'error');
    }
  }

  /* Tick a pending task checkbox -> mark it Completed on the backend. */
  async function completeTask(taskId) {
    try {
      await api.tasks.update(taskId, { status: 'Completed' }, role);
      toast('Task marked as completed.');
      load(); // refresh tasks
    } catch (err) {
      toast(`Failed to complete task: ${err.message}`, 'error');
    }
  }

  /* Save the edit-case modal. */
  async function saveCaseModal() {
    const er = {
      title: editCase.title.trim() ? null : 'Case title is required',
    };
    setModalErrors(er);
    if (Object.values(er).some(Boolean)) return;
    try {
      await saveCase({ ...caseData, case_type: editCase.title, status: editCase.status });
      toast('Case updated.');
      setEditCase(null);
      load();
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    }
  }

  /* Save the edit-client modal. */
  async function saveClientModal() {
    // Only the case-specific fields are editable (the rest is the client's real account).
    const opposing = editClient.opposingParty.trim();
    const errors = {
      opposingParty: opposing && (opposing.length < 2 || opposing.length > 150 || !/[A-Za-z]/.test(opposing))
        ? 'Enter a valid name (2-150 characters, including letters).' : null,
    };
    setModalErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    try {
      await saveCase({ ...caseData, client: { opposingParty: opposing } });
      toast('Client details updated.');
      setEditClient(null);
      load();
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    }
  }

  /* Create a task from the modal. */
  async function saveNewTask() {
    const er = {
      name: addTask.name.trim() ? null : 'Task name is required',
      dueDate: addTask.dueDate ? null : 'Due date is required',
    };
    setModalErrors(er);
    if (Object.values(er).some(Boolean)) return;
    try {
      await api.tasks.create({
        name: addTask.name.trim(),
        caseTitle: title,
        assignedUser: addTask.assignee || '',
        priority: addTask.priority,
        dueDate: addTask.dueDate,
        status: 'Pending',
        caseId: String(caseData.id),
        caseCnr: caseData.cnr || '',
        firmId: user?.firmId || 'firm-1',
        description: '',
      }, role);
      toast('Task created.');
      setAddTask(null);
      load();
    } catch (err) {
      toast(`Create failed: ${err.message}`, 'error');
    }
  }

}

/* ── Small helpers used above ── */

/* One label/value row inside the client details card. */
function InfoRow({ label, value }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

/* "dd MMM yyyy" date format (same as the vanilla firm pages). */
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* Export the case as a CSV file (vanilla had the function but never wired it
   - here the Export button actually works). */
function exportCSV(caseData) {
  const rows = [
    ['Field', 'Value'],
    ['CNR', caseData.cnr || ''],
    ['Case Type', caseData.case_type || caseData.title || ''],
    ['Status', caseData.status || ''],
    ['Filed Date', caseData.filed_date || caseData.filedDate || ''],
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `case_${caseData.cnr || caseData.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
