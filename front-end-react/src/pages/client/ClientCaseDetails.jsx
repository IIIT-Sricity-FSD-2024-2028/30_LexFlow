/**
 * Case Details (client view) - general info, next hearing banner,
 * progress bar, timeline. Documents live on their own page (button below).
 * The :id route segment can be either a case id or a CNR number
 * (vanilla supported both via ?id= and ?cnr=).
 */

import { useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import { Breadcrumb } from '../../components/Layout.jsx';
import {
  Button, Card, Badge, StatusBadge, PageHeader, Loading, ErrorBanner,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

export default function ClientCaseDetails({ id }) {
  const { user, toast } = useApp();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Try to load the case by id; if that fails, try treating it as a CNR. */
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const role = (user?.role || 'client').toLowerCase();
      let data = null;
      try {
        data = await api.cases.getById(id, role);
      } catch {
        // Fallback: search the list and match the CNR column.
        const all = await api.cases.getAll({}, role);
        data = (Array.isArray(all) ? all : []).find((c) => c.cnr === id || String(c.id) === id);
      }
      if (!data) throw new Error('Case not found');

      // The case only holds ids, so look up the law firm and lawyer names.
      const [firm, lawyer] = await Promise.all([
        data.lawfirm_id ? api.lawFirms.getById(data.lawfirm_id, role).catch(() => null) : null,
        data.lawyer_id ? api.users.getById(data.lawyer_id, role).catch(() => null) : null,
      ]);
      data.firmName = firm?.name;
      data.lawyer_name = lawyer?.fullName || lawyer?.name;

      setCaseData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <Loading text="Loading case…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!caseData) return null;

  const title = caseData.case_type || caseData.title || 'Case Details';
  const status = caseData.status || 'Ongoing';
  const desc = caseData.brief_description || caseData.description || '—';
  const progress = caseData.progress || 0;
  const hearing = caseData.nextHearing || {};
  const timeline = caseData.timeline || [];

  /* Split "15 Aug 2026" into the banner's big day + month. */
  const d = hearing.date ? new Date(hearing.date) : null;
  const hearingMonth = d && !isNaN(d) ? d.toLocaleString('en-US', { month: 'short' }).toUpperCase() : '—';
  const hearingDay = d && !isNaN(d) ? d.getDate() : '—';

  return (
    <>
      <Breadcrumb items={[
        { label: 'Cases', href: '/client/cases' },
        { label: `CNR: ${caseData.cnr || 'N/A'}` },
      ]} />

      <PageHeader title="Case Details" subtitle={title}
        actions={
          <Button onClick={() => navigate(`/documents/${caseData.id}`)}>
            <Icon name="document" size={14} /> View Documents
          </Button>
        } />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: general information + hearing banner ── */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 font-bold text-slate-900">General Information</h2>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <FieldBox label="CNR Number" value={<span className="font-mono">{caseData.cnr || '—'}</span>} />
              <FieldBox label="Case Type" value={title} />
              <FieldBox label="Description" value={desc} />
              <FieldBox label="Filed Date" value={
                (() => {
                  const f = caseData.filed_date || caseData.filedDate;
                  if (!f) return 'TBD';
                  const fd = new Date(f);
                  return isNaN(fd) ? f : fd.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
                })()
              } />
              <FieldBox label="Status" value={<StatusBadge status={status} />} />
              <FieldBox label="Law Firm" value={caseData.firmName || '—'} />
              <FieldBox label="Assigned Lawyer" value={
                caseData.lawyer_id || caseData.lawyerId
                  ? (caseData.lawyer_name || caseData.lawyerName || '—')
                  : 'Not assigned yet'
              } />
            </div>
          </Card>

          {/* Next hearing banner */}
          {hearing.date && (
            <Card className="flex items-center gap-5 border-l-4 !border-l-amber-400 p-6">
              <div className="rounded-xl bg-amber-50 px-5 py-4 text-center">
                <p className="text-xs font-bold text-amber-600">{hearingMonth}</p>
                <p className="text-2xl font-extrabold text-amber-600">{hearingDay}</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Next Hearing Scheduled</h3>
                <p className="text-sm text-slate-500">{hearing.time || ''} {hearing.time && '•'} {hearing.description || 'Scheduled Hearing'}</p>
              </div>
            </Card>
          )}
        </div>

        {/* ── Right column: progress + timeline ── */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-bold text-slate-900">Case Progress</h2>
            <p className="mt-2 text-3xl font-extrabold text-brand">{progress}% <span className="text-sm font-medium text-slate-500">Complete</span></p>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-bold text-slate-900">Timeline</h2>
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400">No timeline events recorded.</p>
            ) : (
              <ol className="relative space-y-5 border-l-2 border-slate-100 pl-5">
                {timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-bold ${t.grey ? 'text-slate-400' : 'text-slate-800'}`}>{t.title}</p>
                      {t.upcoming && <Badge variant="amber">UPCOMING</Badge>}
                    </div>
                    <p className="text-xs text-slate-400">{t.date}</p>
                    {t.note && <p className="mt-1 text-xs text-slate-500">{t.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/* Small label/value pair used in the general info grid. */
function FieldBox({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}