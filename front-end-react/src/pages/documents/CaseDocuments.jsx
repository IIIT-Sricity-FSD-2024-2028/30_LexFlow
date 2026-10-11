/**
 * Case Documents - per-case document manager.
 * Role-based permissions (who can upload/update/delete), search + type
 * filter + grid/list views, upload & update modals with version bumps,
 * preview modal, delete confirmation, and an activity side panel.
 * Replaces the 57KB case-documents.js with the same feature set.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import { Breadcrumb } from '../../components/Layout.jsx';
import {
  Button, Card, Badge, StatusBadge, PageHeader, Loading, ErrorBanner, EmptyState,
  Modal, Field, Input, Select, Textarea, FilterDropdown, Avatar,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { initials, formatDate } from '../../lib/format.js';

/* What each role may do (mirrors the backend rules). */
const can = (role, action) => ({
  upload: ['client', 'lawyer', 'firmadmin', 'superadmin'].includes(role),
  update: ['lawyer', 'firmadmin', 'intern', 'superadmin'].includes(role),
  delete: ['lawyer', 'firmadmin', 'superadmin'].includes(role),
}[action]);

const DOC_TYPES = ['CONTRACT', 'CASE EVIDENCE', 'COURT ORDER', 'CLIENT PROOF', 'AFFIDAVIT', 'REPORT'];

export default function CaseDocuments({ caseId }) {
  const { user, toast } = useApp();
  const role = (user?.role || 'client').toLowerCase();

  const [caseData, setCaseData] = useState(null);
  const [docs, setDocs] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');      // null = fine, string = reason

  /* Toolbar */
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [accessFilter, setAccessFilter] = useState([]); // PRIVATE / SHARED
  const [view, setView] = useState('grid');

  /* Modals: upload / update / delete / preview */
  const [uploading, setUploading] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [previewing, setPreviewing] = useState(null);

  /* Log one audit entry to the backend (fire-and-forget). */
  const log = useCallback((action, doc) => {
    api.documents.logActivity({
      user: user?.fullName || user?.name || user?.email || 'Unknown',
      email: user?.email || '', role: user?.role || 'client', firmId: user?.firmId || '',
      caseId, action, docId: doc?.id || '', docName: doc?.name || '', docType: doc?.type || '',
      access: doc?.access || 'SHARED',
    }, role, user?.email);
  }, [caseId, role, user]);

  /* Load the case + its documents + recent activity. */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. The case itself.
      const c = await api.cases.getById(caseId, role);

      // 2. Access check (same rules as the vanilla page).
      // The backend sends snake_case (client_id, lawyer_id, lawfirm_id).
      const isOwner = String(c.client_id ?? c.clientId) === String(user?.id);
      const isFirmStaff = ['firmadmin', 'lawyer', 'intern'].includes(role)
        && String(c.lawfirm_id ?? c.firmId) === String(user?.firmId);
      const isAssigned = String(c.lawyer_id ?? c.lawyerId) === String(user?.id);
      const hasGrant = !!user?.caseAccess?.[caseId];
      if (role !== 'superadmin' && !isOwner && !isFirmStaff && !isAssigned && !hasGrant) {
        setError('NO_DOC_ACCESS');
        return;
      }

      // 3. Documents + activity feed.
      const [d, a] = await Promise.all([
        api.documents.listByCase(caseId, role, user?.email).catch(() => []),
        api.documents.getActivity(caseId, role, user?.email).catch(() => []),
      ]);
      setDocs(Array.isArray(d) ? d : []);
      setActivity(Array.isArray(a) ? a : []);
      // The case only has ids; look up the client and lawyer names.
      const names = {};
      await Promise.allSettled([c.client_id, c.lawyer_id].filter(Boolean).map((id) =>
        api.users.getById(id, role).then((u) => { names[id] = u.fullName || u.name; })));
      setCaseData({ ...c, clientName: names[c.client_id], lawyerName: names[c.lawyer_id] });
    } catch {
      setError('CASE_NOT_FOUND');
    } finally {
      setLoading(false);
    }
  }, [caseId, role, user?.id, user?.firmId, user?.email]);

  useEffect(() => { load(); }, [load]);

  /* Filtering (name/id/type + access checkboxes). Interns see only SHARED. */
  const visible = useMemo(() => {
    let list = docs;
    if (role === 'intern') list = list.filter((d) => d.access === 'SHARED');
    const q = search.toLowerCase();
    if (q) list = list.filter((d) => `${d.name} ${d.id} ${d.type}`.toLowerCase().includes(q));
    if (typeFilter !== 'All') list = list.filter((d) => d.type === typeFilter);
    if (accessFilter.length) list = list.filter((d) => accessFilter.includes(d.access));
    return list;
  }, [docs, search, typeFilter, accessFilter, role]);

  /* ── Actions ── */

  const doUpload = async () => {
    if (!uploading.file) { toast('Please choose a file.', 'error'); return; }
    if (uploading.file.size > 10 * 1024 * 1024) { toast('Maximum file size is 10MB.', 'error'); return; }
    setUploading((u) => ({ ...u, busy: true }));
    try {
      const ext = (uploading.file.name.split('.').pop() || 'BIN').toUpperCase().slice(0, 3);
      const created = await api.documents.upload(uploading.file, {
        name: uploading.file.name, caseId, type: uploading.type, fileType: ext, access: 'PRIVATE', version: 1,
      }, role, user?.email);
      setDocs((l) => [...l, created]);
      log('uploaded', created);
      toast(`${created.name} uploaded successfully`);
      setUploading(null);
    } catch (err) {
      toast(`Upload failed: ${err.message}`, 'error');
      setUploading((u) => ({ ...u, busy: false }));
    }
  };

  const doUpdate = async () => {
    if (!updating.name.trim()) { toast('Document name is required.', 'error'); return; }
    if (!updating.file) { toast('Please attach the new version of the file.', 'error'); return; }
    setUpdating((u) => ({ ...u, busy: true }));
    try {
      const updated = await api.documents.update(updating.id, updating.file, {
        name: updating.name.trim(), access: updating.access, version: (updating.version || 1) + 1,
      }, role, user?.email);
      setDocs((l) => l.map((d) => (d.id === updating.id ? { ...d, ...updated } : d)));
      log('updated', { ...updated, id: updating.id });
      toast('Document updated.');
      setUpdating(null);
    } catch (err) {
      toast(`Update failed: ${err.message}`, 'error');
      setUpdating((u) => ({ ...u, busy: false }));
    }
  };

  const doDelete = async () => {
    try {
      await api.documents.remove(deleting.id, role, user?.email);
    } catch { /* vanilla also removes locally regardless */ }
    setDocs((l) => l.filter((d) => d.id !== deleting.id));
    log('deleted', deleting);
    toast('Document deleted.');
    setDeleting(null);
  };

  /* Download + write an audit entry. */
  const download = (doc) => {
    const url = doc.blobUrl || doc.filePath;
    if (url) {
      const a = document.createElement('a');
      a.href = url; a.download = doc.name; a.click();
    } else {
      // No stored file (or it lives only on the server) -> placeholder text file.
      const text = `LexFlow document download\nFile: ${doc.name}\nDownloaded on: ${new Date().toISOString()}`;
      const blob = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = blob; a.download = doc.name; a.click();
      URL.revokeObjectURL(blob);
    }
    log('downloaded', doc);
    toast(`⬇ Downloading ${doc.name}`);
  };

  /* Access denied / case not found screens. */
  if (error) {
    return (
      <Card className="flex flex-col items-center gap-3 p-14 text-center">
        <Icon name="lock" size={40} className="text-slate-300" />
        <h2 className="font-bold text-slate-800">🔒 Access Denied</h2>
        <p className="max-w-sm text-sm text-slate-500">
          {error === 'CASE_NOT_FOUND'
            ? 'This case could not be found. It may have been removed, or the link is wrong.'
            : 'Your account does not have permission to view documents for this case.'}
        </p>
        <Button variant="outline" onClick={() => navigate('/documents')}>Back to Documents</Button>
      </Card>
    );
  }

  if (loading) return <Loading text="Loading documents…" />;
  if (!caseData) return null;

  const title = caseData.title || caseData.case_type || `Case ${caseId}`;

  return (
    <>
      <Breadcrumb items={[
        { label: 'Documents', href: '/documents' },
        { label: `${title} (${caseData.cnr || caseId})` },
      ]} />

      <PageHeader
        title={title}
        subtitle={`Case ID: ${caseData.cnr || caseId}`}
        actions={
          <Button disabled={!can(role, 'upload')} title={can(role, 'upload') ? '' : 'You do not have upload permission'}
            onClick={() => setUploading({ file: null, type: 'CONTRACT', busy: false })}>
            <Icon name="plus" size={14} /> Upload New Document
          </Button>
        }
      />

      {/* case meta strip */}
      <Card className="mb-6 grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-4">
        {[['CLIENT', caseData.clientName || caseData.client_id || '—'], ['LAWYER', caseData.lawyerName || caseData.lawyer_name || '—'],
          ['COURT', caseData.court || 'District Court'], ['STATUS', caseData.status || 'Active']].map(([l, v]) => (
          <div key={l}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{l}</p>
            <p className="mt-0.5 font-semibold text-slate-800">{v}</p>
          </div>
        ))}
      </Card>

      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="!pl-9" placeholder="Search by document name or document ID" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="!w-40">
          <option>All</option>
          {[...new Set([...DOC_TYPES, ...docs.map((d) => d.type)])].filter(Boolean).map((t) => <option key={t}>{t}</option>)}
        </Select>
        <span className="text-xs font-semibold text-slate-400">Total: {visible.length}</span>
        <FilterDropdown label="Access">
          <div className="space-y-2">
            {['PRIVATE', 'SHARED'].map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={accessFilter.includes(a)}
                  onChange={(e) => setAccessFilter((f) => e.target.checked ? [...f, a] : f.filter((x) => x !== a))} />
                {a}
              </label>
            ))}
          </div>
        </FilterDropdown>
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {['grid', 'list'].map((v) => (
            <button key={v} onClick={() => setView(v)} aria-label={`${v} view`}
              className={`p-2 ${view === v ? 'bg-brand text-white' : 'bg-white text-slate-500'}`}>
              <Icon name={v} size={15} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Documents ── */}
        <div className="lg:col-span-2">
          {visible.length === 0 ? (
            <EmptyState icon="document"
              title={role === 'intern' ? 'No SHARED documents available to interns.' : 'No documents match your criteria.'} />
          ) : view === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((d) => (
                <Card key={d.id} className="flex flex-col p-4">
                  <div className="flex items-start justify-between">
                    <div className={`rounded-lg p-2.5 ${/PDF|CLIENT/i.test(d.type) ? 'bg-red-50 text-red-600' : /EVID|ZIP/i.test(d.type) ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                      <Icon name="document" size={18} />
                    </div>
                    <Badge variant={d.access === 'PRIVATE' ? 'red' : 'green'}>{d.access}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-bold text-slate-800">{d.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">{d.id} · v{d.version || 1}</p>
                  <p className="mt-1 text-xs text-slate-500">{d.uploader || 'Unknown'} · {formatDate(d.date)}</p>
                  <div className="mt-auto flex gap-1.5 pt-3">
                    <Button variant="outline" className="!px-2 !py-1 !text-xs" onClick={() => { setPreviewing(d); log('viewed', d); }}>
                      View
                    </Button>
                    <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => download(d)}>
                      <Icon name="download" size={13} />
                    </Button>
                    {can(role, 'update') && (
                      <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => setUpdating({
                        id: d.id, name: d.name, access: d.access || 'PRIVATE', version: d.version || 1, file: null,
                      })}>
                        <Icon name="edit" size={13} />
                      </Button>
                    )}
                    {can(role, 'delete') && (
                      <Button variant="ghost" className="!px-2 !py-1 !text-xs !text-red-500 hover:!bg-red-50" onClick={() => setDeleting(d)}>
                        <Icon name="trash" size={13} />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="divide-y divide-slate-100">
              {visible.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.id} · {d.type} · {d.uploader || 'Unknown'} · {formatDate(d.date)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={d.access === 'PRIVATE' ? 'red' : 'green'}>{d.access}</Badge>
                    <Button variant="outline" className="!px-2 !py-1 !text-xs" onClick={() => { setPreviewing(d); log('viewed', d); }}>View</Button>
                    <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => download(d)}><Icon name="download" size={13} /></Button>
                    {can(role, 'update') && <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => setUpdating({ id: d.id, name: d.name, access: d.access || 'PRIVATE', version: d.version || 1, file: null })}><Icon name="edit" size={13} /></Button>}
                    {can(role, 'delete') && <Button variant="ghost" className="!px-2 !py-1 !text-xs !text-red-500" onClick={() => setDeleting(d)}><Icon name="trash" size={13} /></Button>}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* ── Side panel: activity + note ── */}
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-bold text-slate-900">Recent Activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-slate-400">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {activity.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Avatar name={a.user} className="h-6 w-6 shrink-0 text-[9px]" />
                    <div>
                      <p className="text-slate-700"><b>{a.user}</b> {a.action} <b>{a.docName}</b></p>
                      <p className="text-slate-400">{formatDate(a.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {role !== 'client' && (
              <Button variant="outline" className="mt-4 w-full !text-xs" onClick={() => navigate('/activity-log')}>
                View All Activity
              </Button>
            )}
          </Card>

          <Card className="bg-amber-50 p-5 !border-amber-200">
            <h2 className="mb-1 font-bold text-amber-800">Quick Note</h2>
            <p className="text-xs leading-relaxed text-amber-700">
              Remember to upload signed documents before the next hearing. Clients can see documents marked SHARED.
            </p>
          </Card>
        </div>
      </div>

      {/* ════════ MODALS ════════ */}

      {/* Upload */}
      <Modal open={!!uploading} onClose={() => setUploading(null)} title="Upload New Document"
        footer={<>
          <Button variant="ghost" onClick={() => setUploading(null)}>Cancel</Button>
          <Button loading={!!uploading?.busy} onClick={doUpload}>+ Upload New Document</Button>
        </>}>
        {uploading && (
          <div className="space-y-4">
            <Field label="Document Type">
              <Select value={uploading.type} onChange={(e) => setUploading((u) => ({ ...u, type: e.target.value }))}>
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Confidential Level">
              <Select defaultValue="Firm Only" disabled className="!bg-slate-50">
                <option>Firm Only</option><option>Client Visible</option><option>Public</option>
              </Select>
            </Field>
            <Field label="Uploaded By">
              <Input value={`${user?.fullName || user?.name || 'User'} (${role})`} readOnly className="!bg-slate-50" />
            </Field>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 hover:border-slate-400">
              <Icon name="upload" size={20} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-600">
                {uploading.file ? `${uploading.file.name} (${Math.round(uploading.file.size / 1024)} KB)` : 'Drag & drop or click to browse'}
              </span>
              <input type="file" className="hidden" accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.zip"
                onChange={(e) => setUploading((u) => ({ ...u, file: e.target.files[0] || null }))} />
            </label>
          </div>
        )}
      </Modal>

      {/* Update (new version) */}
      <Modal open={!!updating} onClose={() => setUpdating(null)} title="Update Document"
        subtitle="Uploading a new file bumps the version."
        footer={<>
          <Button variant="ghost" onClick={() => setUpdating(null)}>Cancel</Button>
          <Button loading={!!updating?.busy} onClick={doUpdate}>Save</Button>
        </>}>
        {updating && (
          <div className="space-y-4">
            <Field label="Document Name" required>
              <Input value={updating.name} maxLength={255} onChange={(e) => setUpdating((u) => ({ ...u, name: e.target.value }))} />
            </Field>
            <Field label="Access">
              <Select value={updating.access} onChange={(e) => setUpdating((u) => ({ ...u, access: e.target.value }))}>
                <option>PRIVATE</option><option>SHARED</option>
              </Select>
            </Field>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Current version: v{updating.version} — a new upload becomes v{updating.version + 1}.</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 hover:border-slate-400">
              <Icon name="upload" size={20} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-600">{updating.file ? updating.file.name : 'Choose new file'}</span>
              <input type="file" className="hidden" accept=".pdf,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setUpdating((u) => ({ ...u, file: e.target.files[0] || null }))} />
            </label>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete Document"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}>Yes, Delete</Button>
        </>}>
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <b>{deleting?.name}</b>? This action cannot be undone.
        </p>
      </Modal>

      {/* Preview */}
      <Modal open={!!previewing} onClose={() => setPreviewing(null)} wide
        title={previewing ? `${previewing.name} · v${previewing.version || 1}` : ''}>
        {previewing && (
          <div>
            {/\.(jpe?g|png|gif|webp|svg)$/i.test(previewing.filePath || previewing.name) ? (
              <img src={previewing.blobUrl || previewing.filePath} alt={previewing.name} className="max-h-[60vh] w-full rounded-lg object-contain" />
            ) : previewing.filePath ? (
              <iframe src={previewing.blobUrl || previewing.filePath} title={previewing.name} className="h-[60vh] w-full rounded-lg border" />
            ) : (
              <div className="flex h-[40vh] flex-col items-center justify-center gap-2 rounded-lg bg-slate-50 text-slate-400">
                <Icon name="document" size={36} />
                <p className="text-sm">No file preview available for this document.</p>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button onClick={() => download(previewing)}><Icon name="download" size={14} /> Download</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}