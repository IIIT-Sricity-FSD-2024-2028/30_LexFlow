/**
 * My Cases - paginated, searchable list of the client's cases.
 * Vanilla: client-cases.html + client-cases.js (3 cases per page).
 */

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import {
  Button, Card, Badge, PageHeader, Loading, ErrorBanner, EmptyState, Pagination, Input,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

const PER_PAGE = 3; // same page size as the vanilla app

export default function ClientCases() {
  const { user } = useApp();

  const [cases, setCases] = useState([]);
  const [firmNames, setFirmNames] = useState({}); // 'firm-1' -> 'Sharma & Associates'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  /* Load this client's cases (backend also scopes by role header). */
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = user?.id ? { clientId: user.id } : {};
      const role = (user?.role || 'client').toLowerCase();
      const list = await api.cases.getAll(filters, role);
      setCases(Array.isArray(list) ? list : []);
      // Cases only hold the firm id, so load the firm directory to show names.
      try {
        const firms = await api.lawFirms.getAll({}, role);
        setFirmNames(Object.fromEntries((Array.isArray(firms) ? firms : []).map((f) => [f.id, f.name])));
      } catch { /* ids are still shown without names */ }
    } catch (err) {
      setError(`Could not load cases: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  /* Client-side search over CNR / title (case-insensitive substring). */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return cases;
    return cases.filter((c) =>
      ((c.case_type || c.title || '') + ' ' + (c.brief_description || '') + ' ' + (c.cnr || '')).toLowerCase().includes(q)
    );
  }, [cases, search]);

  /* Which slice of the list does the current page show? */
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <>
      <PageHeader
        title="My Cases"
        subtitle="All legal cases registered in your name."
        actions={<Button onClick={() => navigate('/client/search')}>New Consultation</Button>}
      />

      {/* Search bar */}
      <div className="relative mb-6 max-w-md">
        <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Search by CNR or case title" value={search} className="!pl-9"
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {loading && <Loading text="Loading cases…" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && visible.length === 0 && <EmptyState icon="briefcase" title="No cases match your search." />}

      {/* Case cards */}
      <div className="space-y-4">
        {visible.map((c) => {
          const title = c.brief_description || c.case_type || c.title || 'Untitled Case';
          const caseType = c.case_type || c.title;
          const status = c.status || 'Ongoing';
          // Prefer the next hearing date; fall back to the filed date.
          const hearingDate = c.nextHearing?.date || c.filed_date || c.filedDate;
          return (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:shadow-md">
              <div className="flex min-w-0 items-start gap-4">
                <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600"><Icon name="briefcase" size={22} /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={status.toLowerCase() === 'ongoing' ? 'amber' : 'green'}>{status}</Badge>
                    {caseType && <Badge>{caseType}</Badge>}
                  </div>
                  <h3 className="mt-2 font-bold text-slate-900">{title}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Icon name="clock" size={12} /> CNR: <span className="font-mono">{c.cnr || '—'}</span></span>
                    <span className="flex items-center gap-1">
                      <Icon name="building" size={12} /> Law Firm: {firmNames[c.lawfirm_id] || '—'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {/* date filed / next hearing */}
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Date Filed</p>
                  <p className="mt-0.5 text-sm font-bold text-brand">{hearingDate || 'TBD'}</p>
                </div>
                <Button variant="outline" onClick={() => navigate(`/client/cases/${c.id}`)}>
                  View Details →
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Pagination page={safePage} pages={pages} total={filtered.length} perPage={PER_PAGE} onPage={setPage} />
    </>
  );
}
