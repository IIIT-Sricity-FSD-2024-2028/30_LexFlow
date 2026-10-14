/**
 * Activity Log - audit trail of document actions (viewed / downloaded /
 * uploaded / updated / deleted). Search + filters + sortable + CSV export.
 * Replaces activity-log.html (whose vanilla inline script had a load-order
 * bug - here the API module is imported, so that class of bug can't happen).
 */

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import {
  Button, Card, Badge, PageHeader, Loading, ErrorBanner, Input, Select, Pagination, Avatar,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { formatDateTime } from '../../lib/format.js';

const PER_PAGE = 15;
const ACTIONS = ['viewed', 'downloaded', 'uploaded', 'updated', 'deleted'];
const ACTION_ICON = { viewed: 'eye', downloaded: 'download', uploaded: 'upload', deleted: 'trash', updated: 'edit' };

export default function ActivityLog() {
  const { user } = useApp();
  const role = (user?.role || 'firmadmin').toLowerCase();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [accessFilter, setAccessFilter] = useState('All');
  const [dateDesc, setDateDesc] = useState(true);
  const [page, setPage] = useState(1);

  /* Load the full audit trail. */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api.documents.getActivity('', role, user?.email);
        setEntries(Array.isArray(data) ? data : []);
      } catch {
        setError('⚠ Could not load activity log. Is the backend running?');
      } finally {
        setLoading(false);
      }
    })();
  }, [role, user?.email]);

  /* Apply every filter together. */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = entries.filter((e) => {
      const okSearch = !q || `${e.user} ${e.docName} ${e.action} ${e.docId}`.toLowerCase().includes(q);
      const okUser = userFilter === 'All' || e.user === userFilter;
      const okAction = actionFilter === 'All' || e.action === actionFilter;
      const okAccess = accessFilter === 'All' || e.access === accessFilter;
      return okSearch && okUser && okAction && okAccess;
    });
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!dateDesc) list.reverse();
    return list;
  }, [entries, search, userFilter, actionFilter, accessFilter, dateDesc]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const users = [...new Set(entries.map((e) => e.user).filter(Boolean))];

  /* Export the filtered rows as a CSV file. */
  const exportCsv = () => {
    const head = 'Date,User,Role,Action,Document,Doc ID,Access';
    const rows = filtered.map((e) =>
      [e.date, e.user, e.role, e.action, e.docName, e.docId, e.access].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const url = URL.createObjectURL(new Blob([[head, ...rows].join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'activity_log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Activity Log"
        subtitle="Who viewed, changed or downloaded what — and when."
        actions={<Button variant="outline" onClick={exportCsv}><Icon name="download" size={14} /> Export CSV</Button>}
      />

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="!pl-9" placeholder="Search by user, document, action…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="!w-40">
          <option>All</option>
          {users.map((u) => <option key={u}>{u}</option>)}
        </Select>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="!w-36">
          <option>All</option>
          {ACTIONS.map((a) => <option key={a}>{a}</option>)}
        </Select>
        <Select value={accessFilter} onChange={(e) => setAccessFilter(e.target.value)} className="!w-32">
          {['All', 'SHARED', 'PRIVATE'].map((a) => <option key={a}>{a}</option>)}
        </Select>
        <Button variant="outline" onClick={() => setDateDesc(!dateDesc)}>
          Sort: {dateDesc ? 'Newest' : 'Oldest'}
        </Button>
      </div>

      {/* quick stat pills (clicking one filters by that action) */}
      <div className="mb-4 flex flex-wrap gap-2">
        <StatPill label={`All ${entries.length}`} active={actionFilter === 'All'} onClick={() => setActionFilter('All')} />
        {ACTIONS.map((a) => (
          <StatPill key={a} label={`${a} ${entries.filter((e) => e.action === a).length}`}
            active={actionFilter === a} onClick={() => { setActionFilter(a); setPage(1); }} />
        ))}
      </div>

      {loading && <Loading text="Loading activity…" />}
      {!loading && error && <ErrorBanner message={error} onRetry={() => window.location.reload()} />}

      {!loading && !error && (
        <Card>
          {/* table head doubles as the date sort toggle */}
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr>
                <th onClick={() => setDateDesc(!dateDesc)} className="cursor-pointer border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 hover:text-brand">
                  Date & Time {dateDesc ? '↓' : '↑'}
                </th>
                <th className="border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">User</th>
                <th className="border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Action</th>
                <th className="border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Document</th>
                <th className="border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Access</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No activity entries match your filters.</td></tr>
              ) : visible.map((e, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="border-b border-slate-50 px-4 py-3 text-xs text-slate-500">{formatDateTime(e.date)}</td>
                  <td className="border-b border-slate-50 px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={e.user} className="h-7 w-7 text-[10px]" />
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">{e.user}</span>
                        <span className="block text-[10px] text-slate-400">{e.role}</span>
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-slate-50 px-4 py-3">
                    <Badge variant={e.action === 'deleted' ? 'red' : e.action === 'uploaded' ? 'green' : 'blue'}>
                      {ACTION_ICON[e.action]} {e.action}
                    </Badge>
                  </td>
                  <td className="border-b border-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-800">{e.docName}</p>
                    <p className="text-[10px] text-slate-400">{e.docId} · {e.docType}</p>
                  </td>
                  <td className="border-b border-slate-50 px-4 py-3">
                    <Badge variant={e.access === 'PRIVATE' ? 'red' : 'slate'}>{e.access}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={safePage} pages={pages} total={filtered.length} perPage={PER_PAGE} onPage={setPage} />
          </div>
        </Card>
      )}
    </>
  );
}

/* One clickable filter pill in the stats bar. */
function StatPill({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${active ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
      {label}
    </button>
  );
}