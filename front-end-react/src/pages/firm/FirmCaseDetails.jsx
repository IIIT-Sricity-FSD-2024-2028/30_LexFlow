/**
 * Case Details (firm + lawyer) - the richest page in the app.
 * Sections: header (edit), progress bar with 5 phases, client details,
 * pending tasks, core team, editable timeline, document management.
 * Modals: edit case, edit client, edit team, add task, upload document,
 * timeline event editor.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import { Breadcrumb } from '../../components/Layout.jsx';
import {
  Button, Card, Badge, StatusBadge, PageHeader, Loading, ErrorBanner,
  Modal, Field, Input, Select, Textarea, Table, Th, Td,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { formatDate } from '../../lib/format.js';
import { validateName, validateEmail, validateIndianPhone, normalizeIndianPhone } from '../../lib/validators.js';

/* The five progress phases - each one covers 20% of progress. */
const PHASES = ['Filing', 'Preparation', 'Discovery', 'Mediation', 'Trial'];
const phaseIndex = (p) => Math.min(4, Math.floor(Number(p || 0) / 20));

export default function FirmCaseDetails({ id }) {
  const { user, toast } = useApp();
  const role = (user?.role || 'firmadmin').toLowerCase();

  /* ── Page data ── */
  const [caseData, setCaseData] = useState(null);   // the case itself
  const [tasks, setTasks] = useState([]);           // tasks attached to this case
  const [firmMembers, setFirmMembers] = useState([]); // for assignee/team dropdowns
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* ── Modal state (null = closed) ── */
  const [editCase, setEditCase] = useState(null);       // edit case details form
  const [editClient, setEditClient] = useState(null);   // edit client details form
  const [editTeam, setEditTeam] = useState(null);       // edit team form
  const [addTask, setAddTask] = useState(null);         // new task form
  const [uploadDoc, setUploadDoc] = useState(null);     // upload document form
  const [editTimeline, setEditTimeline] = useState(null); // timeline event form
  const [modalErrors, setModalErrors] = useState({});   // per-modal validation errors

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

      // Documents live in their own endpoint - overlay them onto the case.
      try {
        const docs = await api.documents.listByCase(data.id, role, user?.email);
        if (Array.isArray(docs)) data.documents = docs;
      } catch { /* keep whatever documents the case object already had */ }

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

  /* Firm members for the team/assignee dropdowns. */
  useEffect(() => {
    api.users.getLawyers(user?.firmId, role)
      .then((l) => setFirmMembers(Array.isArray(l) ? l : []))
      .catch(() => {});
  }, [role, user?.firmId]);

  /* ── Derived values ── */
  const pendingTasks = (tasks || []).filter((t) => t.status !== 'Completed');
  const documents = caseData?.documents || [];
  const team = caseData?.team || [];
  const timeline = caseData?.timeline || [];
  const client = caseData?.client || {};
  const progress = caseData?.progress || 0;
  const pIdx = phaseIndex(progress);
  const phaseSuffix = pIdx === 0 ? ' & Documentation' : pIdx === 2 ? ' & Evidence Collection' : '';

  /* PATCH helper: send the whole case object back (vanilla did the same). */
  const saveCase = async (updated) => {
    const { id: _skip, created_at: _skip2, ...body } = updated; // id + createdAt stay out
    const saved = await api.cases.update(updated.id, body, role);
    setCaseData((c) => ({ ...c, ...saved }));
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
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{title} | Opened: {formatDate(caseData.filed_date || caseData.filedDate)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setModalErrors({}); setEditCase({ title, status: caseData.status || 'Ongoing', progress }); }}>
            Edit Details
          </Button>
          <Button variant="outline" onClick={() => exportCSV(caseData)}>
            <Icon name="download" size={14} /> Export
          </Button>
        </div>
      </Card>

      {/* ── Progress bar with the five phases ── */}
      <Card className="mb-6 p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-slate-900">Phase {pIdx + 1}: {PHASES[pIdx]}{phaseSuffix}</p>
          <p className="text-sm font-bold text-brand">{progress}% Completed</p>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs font-semibold">
          {PHASES.map((p, i) => (
            <span key={p} className={i <= pIdx ? 'text-brand' : 'text-slate-300'}>{p}</span>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ════════ LEFT COLUMN ════════ */}
        <div className="space-y-6">
          {/* client details card */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Client Details</h2>
              <button className="text-xs font-semibold text-indigo-600 hover:underline"
                onClick={() => { setModalErrors({}); setEditClient({
                  contact: client.contact || '', email: client.email || '', phone: client.phone || '',
                  type: client.type || 'Corporate', opposingParty: client.opposingParty || '',
                }); }}>
                Edit
              </button>
            </div>
            <InfoRow label="Contact" value={client.contact || 'Data Pending'} />
            <InfoRow label="Email" value={client.email || '—'} />
            <InfoRow label="Phone" value={client.phone || '—'} />
            <InfoRow label="Account Type" value={client.type || 'Corporate'} />
            <InfoRow label="Opposing Party" value={client.opposingParty || '—'} />
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
              <p className="text-sm text-slate-400">No pending tasks. 🎉</p>
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
            <Button variant="outline" className="mt-4 w-full !text-xs" onClick={() => navigate('/firm/tasks')}>
              View All Tasks
            </Button>
          </Card>

          {/* core team card */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Core Team</h2>
              <button className="text-xs font-semibold text-indigo-600 hover:underline"
                onClick={() => setEditTeam({ list: [...team], newId: '', newRole: 'Legal Counsel' })}>
                Edit
              </button>
            </div>
            <div className="space-y-3">
              {team.length === 0 && <p className="text-sm text-slate-400">No team members assigned.</p>}
              {team.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {initials(m.name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ════════ RIGHT COLUMN ════════ */}
        <div className="space-y-6 lg:col-span-2">
          {/* timeline card */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Case Timeline</h2>
              <Button variant="outline" className="!px-3 !py-1.5 !text-xs"
                onClick={() => { setModalErrors({}); setEditTimeline({ index: null, title: '', date: '', note: '', upcoming: false }); }}>
                + Add Timeline Event
              </Button>
            </div>
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400">No timeline events recorded.</p>
            ) : (
              <ol className="relative space-y-5 border-l-2 border-slate-100 pl-5">
                {timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className={`text-sm font-bold ${t.grey ? 'text-slate-400' : 'text-slate-800'}`}>{t.title}</p>
                        <p className="text-xs text-slate-400">{t.date}</p>
                        {t.note && <p className="mt-1 text-xs text-slate-500">{t.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {t.upcoming && <Badge variant="amber">UPCOMING</Badge>}
                        <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" aria-label="Edit event"
                          onClick={() => { setModalErrors({}); setEditTimeline({
                            index: i, title: t.title, date: toISODate(t.date), note: t.note || '', upcoming: !!t.upcoming,
                          }); }}>
                          <Icon name="edit" size={13} />
                        </button>
                        <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500" aria-label="Delete event"
                          onClick={() => deleteTimeline(i)}>
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* document management card */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Document Management</h2>
              <Button variant="outline" className="!px-3 !py-1.5 !text-xs"
                onClick={() => { setModalErrors({}); setUploadDoc({ file: null, type: 'PDF', access: 'Firm Only', description: '', busy: false }); }}>
                + Add Document
              </Button>
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-400">No documents uploaded yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr><Th>Document Name</Th><Th>Uploaded Date</Th><Th>Status</Th><Th>Actions</Th></tr>
                </thead>
                <tbody>
                  {documents.map((doc, i) => (
                    <tr key={doc.id || i} className="hover:bg-slate-50">
                      <Td>
                        <span className="flex items-center gap-2">
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            {String(doc.type || 'PDF').slice(0, 4).toUpperCase()}
                          </span>
                          {doc.name}
                        </span>
                      </Td>
                      <Td>{fmtDate(doc.date)}</Td>
                      <Td><StatusBadge status={doc.status || 'Verified'} /></Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => downloadDoc(doc)}>
                            Download
                          </button>
                          <button className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Delete document"
                            onClick={() => deleteDocument(doc, i)}>
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>

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
            <Field label="Progress (0-100)" required error={modalErrors.progress}>
              <Input type="number" min="0" max="100" value={editCase.progress}
                onChange={(e) => setEditCase((c) => ({ ...c, progress: e.target.value }))} error={!!modalErrors.progress} />
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
            <Field label="Contact Person" required error={modalErrors.contact}>
              <Input value={editClient.contact} onChange={(e) => setEditClient((c) => ({ ...c, contact: e.target.value }))} error={!!modalErrors.contact} />
            </Field>
            <Field label="Email" required error={modalErrors.email}>
              <Input type="email" value={editClient.email} onChange={(e) => setEditClient((c) => ({ ...c, email: e.target.value }))} error={!!modalErrors.email} />
            </Field>
            <Field label="Phone" required error={modalErrors.phone}>
              <Input value={editClient.phone} onChange={(e) => setEditClient((c) => ({ ...c, phone: e.target.value }))} error={!!modalErrors.phone} />
            </Field>
            <Field label="Account Type">
              <Select value={editClient.type} onChange={(e) => setEditClient((c) => ({ ...c, type: e.target.value }))}>
                {['Corporate', 'Individual', 'SME'].map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Opposing Counsel" error={modalErrors.opposingParty}>
              <Input value={editClient.opposingParty} maxLength={150} onChange={(e) => setEditClient((c) => ({ ...c, opposingParty: e.target.value }))} error={!!modalErrors.opposingParty} />
            </Field>
          </div>
        )}
      </Modal>

      {/* Edit core team */}
      <Modal open={!!editTeam} onClose={() => setEditTeam(null)} title="Edit Core Team"
        footer={<>
          <Button variant="ghost" onClick={() => setEditTeam(null)}>Done</Button>
          <Button onClick={saveTeamModal}>Save Team</Button>
        </>}>
        {editTeam && (
          <div className="space-y-4">
            {/* current members with remove buttons */}
            {editTeam.list.map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-400">{m.role}</p>
                </div>
                <button className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Remove member"
                  onClick={() => setEditTeam((t) => ({ ...t, list: t.list.filter((_, j) => j !== i) }))}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            {/* add-member row */}
            <div className="flex gap-2">
              <Select className="flex-1" value={editTeam.newId} onChange={(e) => setEditTeam((t) => ({ ...t, newId: e.target.value }))}>
                <option value="">Select member…</option>
                {firmMembers.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.name}</option>)}
              </Select>
              <Input className="!w-32" placeholder="Role" value={editTeam.newRole}
                onChange={(e) => setEditTeam((t) => ({ ...t, newRole: e.target.value }))} />
              <Button variant="outline" onClick={() => {
                const u = firmMembers.find((x) => String(x.id) === String(editTeam.newId));
                if (!u) return; // nothing selected
                setEditTeam((t) => ({ ...t, list: [...t.list, { id: u.id, name: u.fullName || u.name, role: t.newRole || 'Legal Counsel' }], newId: '' }));
              }}>Add</Button>
            </div>
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

      {/* Upload document */}
      <Modal open={!!uploadDoc} onClose={() => setUploadDoc(null)} title="Upload New Document"
        footer={<>
          <Button variant="ghost" onClick={() => setUploadDoc(null)}>Cancel</Button>
          <Button loading={!!uploadDoc?.busy} onClick={saveDocumentModal}>+ Upload New Document</Button>
        </>}>
        {uploadDoc && (
          <div className="space-y-4">
            <Field label="Client Name"><Input value={title.split('vs.')[0].trim()} readOnly className="!bg-slate-50" /></Field>
            <Field label="Case CNR"><Input value={caseData.cnr || caseData.id} readOnly className="!bg-slate-50" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Document Type">
                <Select value={uploadDoc.type} onChange={(e) => setUploadDoc((d) => ({ ...d, type: e.target.value }))}>
                  <option>PDF</option><option>DOC</option><option>ZIP</option>
                </Select>
              </Field>
              <Field label="Confidential Level">
                <Select value={uploadDoc.access} onChange={(e) => setUploadDoc((d) => ({ ...d, access: e.target.value }))}>
                  <option>Firm Only</option><option>Client Visible</option><option>Public</option>
                </Select>
              </Field>
            </div>
            <Field label="Uploader"><Input value={user?.fullName || user?.name || 'Firm Admin'} readOnly className="!bg-slate-50" /></Field>
            <Field label="Description">
              <Textarea rows={2} value={uploadDoc.description} onChange={(e) => setUploadDoc((d) => ({ ...d, description: e.target.value }))} />
            </Field>
            {/* click-to-browse file zone */}
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-slate-400">
              <Icon name="upload" size={20} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-600">
                {uploadDoc.file ? `Selected: ${uploadDoc.file.name}` : 'Click to browse files'}
              </span>
              <input type="file" className="hidden" onChange={(e) => setUploadDoc((d) => ({ ...d, file: e.target.files[0] || null }))} />
            </label>
          </div>
        )}
      </Modal>

      {/* Timeline event editor (adds OR edits, depending on index) */}
      <Modal open={!!editTimeline} onClose={() => setEditTimeline(null)}
        title={editTimeline?.index != null ? 'Edit Timeline Event' : 'Add Timeline Event'}
        footer={<>
          <Button variant="ghost" onClick={() => setEditTimeline(null)}>Cancel</Button>
          <Button onClick={saveTimeline}>Save Event</Button>
        </>}>
        {editTimeline && (
          <div className="space-y-4">
            <Field label="Event Title" required error={modalErrors.tlTitle}>
              <Input value={editTimeline.title} maxLength={120}
                onChange={(e) => setEditTimeline((t) => ({ ...t, title: e.target.value }))} error={!!modalErrors.tlTitle} />
            </Field>
            <Field label="Date" required error={modalErrors.tlDate}>
              <Input type="date" value={editTimeline.date}
                onChange={(e) => setEditTimeline((t) => ({ ...t, date: e.target.value }))} error={!!modalErrors.tlDate} />
            </Field>
            <Field label="Notes">
              <Textarea rows={2} value={editTimeline.note} onChange={(e) => setEditTimeline((t) => ({ ...t, note: e.target.value }))} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={editTimeline.upcoming}
                onChange={(e) => setEditTimeline((t) => ({ ...t, upcoming: e.target.checked }))} />
              Mark as upcoming
            </label>
          </div>
        )}
      </Modal>
    </>
  );

  /* ══════════════ ACTION HANDLERS (defined after JSX, hoisted functions) ══════════════ */

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
      progress: (editCase.progress !== '' && !isNaN(editCase.progress) && editCase.progress >= 0 && editCase.progress <= 100)
        ? null : 'Progress must be between 0 and 100',
    };
    setModalErrors(er);
    if (Object.values(er).some(Boolean)) return;
    try {
      await saveCase({ ...caseData, case_type: editCase.title, status: editCase.status, progress: Number(editCase.progress) });
      toast('Case updated.');
      setEditCase(null);
      load();
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    }
  }

  /* Save the edit-client modal. */
  async function saveClientModal() {
    // Same validators the onboarding forms use (each returns an error text or null).
    const errors = {
      contact: validateName(editClient.contact, { twoWords: false }),
      email: validateEmail(editClient.email),
      phone: validateIndianPhone(editClient.phone),
      opposingParty: editClient.opposingParty.length > 150 ? 'Maximum 150 characters.' : null,
    };
    setModalErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    try {
      await saveCase({ ...caseData, client: { ...editClient, phone: normalizeIndianPhone(editClient.phone) } });
      toast('Client details updated.');
      setEditClient(null);
      load();
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    }
  }

  /* Save the edited team list. */
  async function saveTeamModal() {
    try {
      await saveCase({ ...caseData, team: editTeam.list });
      toast('Team updated.');
      setEditTeam(null);
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

  /* Upload a document (multipart form, like the vanilla page). */
  async function saveDocumentModal() {
    if (!uploadDoc.file) {
      toast('Please choose a file to upload.', 'error');
      return;
    }
    setUploadDoc((d) => ({ ...d, busy: true }));
    try {
      const ext = (uploadDoc.file.name.split('.').pop() || 'BIN').toUpperCase().slice(0, 3);
      const typeMap = { PDF: 'CLIENT PROOF', DOC: 'CONTRACT', ZIP: 'CASE EVIDENCE' };
      const created = await api.documents.upload(uploadDoc.file, {
        name: uploadDoc.file.name,
        caseId: caseData.id,
        type: typeMap[uploadDoc.type] || uploadDoc.type,
        fileType: ext,
        access: uploadDoc.access.includes('Firm') ? 'PRIVATE' : 'SHARED',
      }, role, user?.email);
      setCaseData((c) => ({ ...c, documents: [...(c.documents || []), created] }));
      toast(`${uploadDoc.file.name} uploaded successfully`);
      setUploadDoc(null);
    } catch (err) {
      toast(`Upload failed: ${err.message}`, 'error');
      setUploadDoc((d) => ({ ...d, busy: false }));
    }
  }

  /* Delete a document (server call first, then local splice). */
  async function deleteDocument(doc, index) {
    if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    try {
      if (String(doc.id || '').startsWith('DOC-')) {
        await api.documents.remove(doc.id, role, user?.email);
      }
    } catch { /* local removal happens regardless, like vanilla */ }
    setCaseData((c) => ({ ...c, documents: c.documents.filter((_, i) => i !== index) }));
    toast('Document removed.');
  }

  /* Save a timeline event (add when index is null, edit otherwise). */
  async function saveTimeline() {
    const er = {
      tlTitle: editTimeline.title.trim() ? null : 'Event title is required',
      tlDate: editTimeline.date ? null : 'Date is required',
    };
    setModalErrors(er);
    if (Object.values(er).some(Boolean)) return;

    const event = {
      title: editTimeline.title.trim(),
      date: new Date(editTimeline.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      note: editTimeline.note,
      upcoming: editTimeline.upcoming,
    };
    const list = [...timeline];                 // copy the current array
    if (editTimeline.index != null) list[editTimeline.index] = event; // edit in place
    else list.unshift(event);                                          // newest first

    try {
      await saveCase({ ...caseData, timeline: list });
      toast('Timeline updated.');
      setEditTimeline(null);
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    }
  }

  /* Delete a timeline event. */
  async function deleteTimeline(index) {
    if (!window.confirm('Delete this event?')) return;
    try {
      await saveCase({ ...caseData, timeline: timeline.filter((_, i) => i !== index) });
      toast('Event deleted.');
    } catch (err) {
      toast(`Delete failed: ${err.message}`, 'error');
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

/* Parse a display date back into YYYY-MM-DD for <input type="date">. */
function toISODate(v) {
  const d = new Date(v);
  return isNaN(d) ? '' : d.toISOString().split('T')[0];
}

/* Download a placeholder file for a document (same as the client page). */
function downloadDoc(doc) {
  const text = `LexFlow document download\nFile: ${doc.name}\nDownloaded on: ${new Date().toISOString()}`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.name;
  a.click();
  URL.revokeObjectURL(url);
}

/* Export the case as a CSV file (vanilla had the function but never wired it
   - here the Export button actually works). */
function exportCSV(caseData) {
  const rows = [
    ['Field', 'Value'],
    ['CNR', caseData.cnr || ''],
    ['Case Type', caseData.case_type || caseData.title || ''],
    ['Status', caseData.status || ''],
    ['Progress', `${caseData.progress || 0}%`],
    ['Filed Date', caseData.filed_date || caseData.filedDate || ''],
    [],
    ['Timeline Title', 'Date', 'Note'],
    ...(caseData.timeline || []).map((t) => [t.title, t.date, t.note || '']),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `case_${caseData.cnr || caseData.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}