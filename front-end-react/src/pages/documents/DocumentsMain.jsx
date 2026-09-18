/**
 * Document Management hub - pick a case to manage its documents.
 * Grid/list views, live search, status filter, sorting. Replaces
 * documents-main.html + documents-main.js.
 */

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import {
  Button, Card, Badge, PageHeader, Loading, ErrorBanner, EmptyState, Input, FilterDropdown, Avatar,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

export default function DocumentsMain() {
  const { user } = useApp();
  const role = (user?.role || 'client').toLowerCase();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState([]); // ['Active','Pending','Closed']
  const [sortKey, setSortKey] = useState(null);          // 'client' | 'id'
  const [sortAsc, setSortAsc] = useState(true);
  const [view, setView] = useState('grid');              // 'grid' | 'list'

  /* Load the role-scoped case list. */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const filters = role === 'client' && user?.id ? { clientId: user.id }
          : role === 'lawyer' && user?.id ? { lawyerId: user.id }
          : user?.firmId ? { firmId: user.firmId } : {};
        const list = await api.cases.getAll(filters, role);
        setCases(Array.isArray(list) ? list : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [role, user?.id, user?.firmId]);

  /* Build the display model per case (same fallbacks as the vanilla script). */
  const cards = useMemo(() => {
    const mapStatus = (s) => {
      const v = String(s || '').toLowerCase();
      if (v === 'pending') return 'Pending';
      if (v === 'closed') return 'Closed';
      return 'Active';
    };
    let list = cases.map((c) => ({
      id: String(c.id),
      cnr: c.cnr || '',
      client: c.client_name || c.clientName || 'Unknown Client',
      status: mapStatus(c.status),
      caseType: c.case_type || c.title || 'Case',
      lawyer: c.lawyer_name || c.lawyerName || 'Unknown Lawyer',
      court: c.court || 'District Court',
    }));

    // search over every text field
    const q = search.toLowerCase();
    if (q) list = list.filter((c) =>
      `${c.client} ${c.id} ${c.cnr} ${c.caseType} ${c.lawyer} ${c.court}`.toLowerCase().includes(q));

    // status checkboxes
    if (statusFilter.length) list = list.filter((c) => statusFilter.includes(c.status));

    // sorting (click the sort button again to flip direction)
    if (sortKey) {
      list.sort((a, b) => {
        const r = String(a[sortKey]).localeCompare(String(b[sortKey]));
        return sortAsc ? r : -r;
      });
    }
    return list;
  }, [cases, search, statusFilter, sortKey, sortAsc]);

  const statusTone = (s) => (s === 'Active' ? 'green' : s === 'Closed' ? 'red' : 'amber');

  return (
    <>
      <PageHeader
        title="Document Management"
        subtitle="Select a case to manage its legal documents."
        actions={
          <FilterDropdown label="Status">
            {/* checkboxes + apply/clear */}
            <div className="space-y-2">
              {['Active', 'Pending', 'Closed'].map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300"
                    checked={statusFilter.includes(s)}
                    onChange={(e) => setStatusFilter((f) => e.target.checked ? [...f, s] : f.filter((x) => x !== s))} />
                  {s}
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="!px-2 !py-1 !text-xs" onClick={() => setStatusFilter([])}>Clear</Button>
              </div>
            </div>
          </FilterDropdown>
        }
      />

      {/* toolbar: search + sort + view toggle */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="!pl-9" placeholder="Search clients by name, case ID, or CNR" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => { setSortKey('client'); setSortAsc(sortKey === 'client' ? !sortAsc : true); }}>
          Sort: Client {sortKey === 'client' ? (sortAsc ? '↑' : '↓') : ''}
        </Button>
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {[['grid', 'grid'], ['list', 'list']].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)} aria-label={`${v} view`}
              className={`p-2 ${view === v ? 'bg-brand text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
              <Icon name={icon} size={16} />
            </button>
          ))}
        </div>
      </div>

      {loading && <Loading text="Loading cases…" />}
      {!loading && error && <ErrorBanner message={`Error loading cases: ${error}`} onRetry={() => window.location.reload()} />}
      {!loading && !error && cards.length === 0 && <EmptyState icon="document" title="No cases match your criteria." />}

      {/* ── Grid view ── */}
      {!loading && !error && view === 'grid' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.id} className="flex flex-col p-5">
              <div className="flex items-center justify-between">
                <Badge variant="indigo">INDIVIDUAL</Badge>
                <Badge variant={statusTone(c.status)}>● {c.status}</Badge>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Avatar name={c.client} className="h-10 w-10" />
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-slate-900">{c.client}</h3>
                  <p className="font-mono text-xs text-slate-400">CASE-{c.id} · {c.cnr}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{c.caseType}</p>
              <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <p>Adv. {c.lawyer}</p>
                <p className="mt-0.5">{c.court}</p>
              </div>
              <Button variant="outline" className="mt-4 !text-xs" onClick={() => navigate(`/documents/${c.id}`)}>
                Manage Documents →
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* ── List view ── */}
      {!loading && !error && view === 'list' && cards.length > 0 && (
        <Card className="divide-y divide-slate-100">
          {cards.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={c.client} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{c.client} <span className="font-mono text-xs text-slate-400">CASE-{c.id}</span></p>
                  <p className="text-xs text-slate-400">{c.caseType} · Adv. {c.lawyer} · {c.court}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={statusTone(c.status)}>{c.status}</Badge>
                <Button variant="outline" className="!px-3 !py-1 !text-xs" onClick={() => navigate(`/documents/${c.id}`)}>
                  Manage →
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}