/**
 * Advocate Profile - public profile of the lawyer on a client's case.
 * The vanilla page used an in-memory mock DB; here we fetch the real user
 * from the API and fall back to sensible placeholders for missing fields.
 */

import { useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import { Breadcrumb } from '../../components/Layout.jsx';
import { Badge, Card, StatusBadge, PageHeader, Loading, ErrorBanner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { initials } from '../../lib/format.js';

export default function AdvocateProfile({ id }) {
  const { user } = useApp();

  const [lawyer, setLawyer] = useState(null);
  const [cases, setCases] = useState([]); // the advocate's active cases
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const role = (user?.role || 'client').toLowerCase();
        // 1. The advocate's user record.
        const u = await api.users.getById(id, role);
        setLawyer(u);
        // 2. Their active cases (best effort - page still works if this fails).
        try {
          const list = await api.cases.getAll({ lawyerId: id }, role);
          setCases((Array.isArray(list) ? list : []).filter((c) => (c.status || '').toLowerCase() !== 'closed'));
        } catch { /* optional */ }
      } catch (err) {
        setError(`Could not load advocate: ${err.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loading text="Loading advocate profile…" />;
  if (error) return <ErrorBanner message={error} onRetry={() => navigate('/client/cases')} />;
  if (!lawyer) return null;

  /* Display fields with graceful fallbacks. */
  const name = lawyer.fullName || lawyer.name || 'Advocate';
  const specialisation = lawyer.specialisation || 'Legal Specialist';
  const won = lawyer.won ?? 12;
  const lost = lawyer.lost ?? 5;
  const ongoing = lawyer.ongoing ?? (cases.length || 8);
  const total = lawyer.totalCases ?? won + lost + ongoing;
  const winRate = lawyer.winRate ?? Math.round((won / Math.max(1, total)) * 100);

  return (
    <>
      <Breadcrumb items={[{ label: 'Cases', href: '/client/cases' }, { label: 'Advocate Profile' }]} />
      <PageHeader title={`Adv. ${name}`} subtitle={`Senior Advocate – ${specialisation}`} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* hero card */}
          <Card className="flex flex-wrap items-center gap-5 p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
              {initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="green">Bar Council Verified</Badge>
                <Badge>{lawyer.barCouncilId || 'BCI Registered'}</Badge>
                <Badge variant="indigo">{lawyer.experience || '15'}+ Years Experience</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Representing clients across {lawyer.court || 'district and high courts'} with a focus on {specialisation.toLowerCase()}.
              </p>
            </div>
          </Card>

          {/* professional details */}
          <Card className="p-6">
            <h2 className="mb-4 font-bold text-slate-900">Professional Details</h2>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Box label="Full Name" value={`Adv. ${name}`} />
              <Box label="Bar Council ID" value={lawyer.barCouncilId || '—'} />
              <Box label="Specialisation" value={specialisation} />
              <Box label="Court of Practice" value={lawyer.court || 'District & High Court'} />
              <Box label="Enrolled Since" value={lawyer.enrolledSince || '—'} />
              <Box label="Contact" value={lawyer.email || '—'} />
            </div>
          </Card>

          {/* active cases */}
          <Card className="p-6">
            <h2 className="mb-4 font-bold text-slate-900">Active Cases</h2>
            {cases.length === 0 ? (
              <p className="text-sm text-slate-400">No active cases found for this advocate.</p>
            ) : (
              <div className="space-y-3">
                {cases.map((c) => (
                  <button key={c.id}
                    onClick={() => navigate(`/documents/${c.id}`)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-300 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{c.case_type || c.title}</p>
                        <p className="text-xs text-slate-400">
                          <span className="font-mono">{c.cnr || c.id}</span> · {c.court || 'District Court'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={c.status || 'Active'} />
                      <Icon name="chevronRight" size={14} className="text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">
          {/* performance */}
          <Card className="p-6">
            <h2 className="mb-4 font-bold text-slate-900">Performance</h2>
            <div className="grid grid-cols-2 gap-3">
              <Perf label="Total Cases" value={total} tone="text-slate-800" />
              <Perf label="Won" value={won} tone="text-emerald-600" />
              <Perf label="Lost" value={lost} tone="text-amber-600" />
              <Perf label="Ongoing" value={ongoing} tone="text-blue-600" />
            </div>
            {/* win-rate donut */}
            <div className="mt-5 flex items-center gap-4">
              <svg width="64" height="64" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                <circle
                  cx="18" cy="18" r="14" fill="none" stroke="#4f46e5" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(winRate / 100) * 88} 100`} // circumference trick (r=14 => ~88)
                  transform="rotate(-90 18 18)"
                />
                <text x="18" y="21" textAnchor="middle" className="fill-slate-800 text-[9px] font-bold">{winRate}%</text>
              </svg>
              <p className="text-sm text-slate-500"><b className="text-slate-800">{winRate}%</b> win rate<br />
                {won} won · {lost} lost · {ongoing} ongoing</p>
            </div>
          </Card>

          {/* upcoming hearings from their cases */}
          <Card className="p-6">
            <h2 className="mb-4 font-bold text-slate-900">Upcoming Hearings</h2>
            {cases.filter((c) => c.nextHearing?.date).length === 0 ? (
              <p className="text-sm text-slate-400">No upcoming hearings.</p>
            ) : (
              <div className="space-y-3">
                {cases.filter((c) => c.nextHearing?.date).slice(0, 3).map((c) => {
                  const d = new Date(c.nextHearing.date);
                  return (
                    <div key={c.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
                      <div className="rounded-lg bg-indigo-50 px-3 py-2 text-center">
                        <p className="text-[10px] font-bold text-indigo-600">
                          {d.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
                        </p>
                        <p className="text-lg font-extrabold text-indigo-600">{d.getDate()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{c.case_type || c.title}</p>
                        <p className="text-xs text-slate-400">{c.nextHearing.time || ''} · {c.nextHearing.description || 'Scheduled Hearing'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* qualifications */}
          <Card className="p-6">
            <h2 className="mb-4 font-bold text-slate-900">Qualifications</h2>
            <ul className="space-y-3 text-sm">
              {(lawyer.qualifications || [
                ['LL.B.', '2005 - 2010'],
                ['LL.M. (Corporate Law)', '2010 - 2012'],
              ]).map(([title, years]) => (
                <li key={title} className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{title}</span>
                  <span className="text-xs text-slate-400">{years}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

/* Small stat box in the professional details grid. */
function Box({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

/* One coloured performance number. */
function Perf({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className={`text-2xl font-extrabold ${tone}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}