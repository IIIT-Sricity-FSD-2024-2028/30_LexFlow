/**
 * Case List (firm + lawyer) - tabbed page: "All Cases" and "Pending Tasks".
 * Search + filters + pagination (4 per page, like vanilla firm-cases.js /
 * lawyer-cases.js). Lawyers see only tasks assigned to them.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import {
  Button, Card, Badge, StatusBadge, PageHeader, Loading, ErrorBanner, EmptyState,
  Tabs, FilterDropdown, Pagination, Input, Select,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

const PER_PAGE = 4;

export default function FirmCases() {
  const { user, toast } = useApp();
  const role = (user?.role || 'firmadmin').toLowerCase();
  const isLawyer = role === 'lawyer';

  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tab, setTab] = useState('all');            // 'all' | 'pending'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [taskStatusFilter, setTaskStatusFilter] = useState('All');
  const [page, setPage] = useState(1);

  /* Load cases + tasks in one go. */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const caseFilters = role === 'client' && user?.id ? { clientId: user.id }
        : role === 'lawyer' && user?.id ? { lawyerId: user.id }
        : user?.firmId ? { firmId: user.firmId } : {};
      const [c, t] = await Promise.all([
        api.cases.getAll(caseFilters, role),
        api.tasks.getAll(
          // Lawyers see only their own tasks; admins see the whole firm.
          isLawyer ? { assignedUser: user.fullName || user.name, firmId: user?.firmId } : { firmId: user?.firmId },
          role
        ),
      ]);
      setCases(Array.isArray(c) ? c : []);
      setTasks(Array.isArray(t) ? t : []);
    } catch (err) {
      setError(`Could not load cases: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [role, isLawyer, user?.id, user?.firmId, user?.fullName, user?.name]);

  useEffect(() => { load(); }, [load]);

  /* ── Filtering (client-side, like the vanilla scripts) ── */
  const filteredCases = useMemo(() => {
    const q = search.toLowerCase();
    return cases.filter((c) => {
      const okSearch = !q || `${c.case_type || c.title} ${c.cnr}`.toLowerCase().includes(q);
      const okStatus = statusFilter === 'All' || c.status === statusFilter;
      return okSearch && okStatus;
    });
  }, [cases, search, statusFilter]);

  const filteredTasks = useMemo(() => {
    const q = search.toLowerCase();
    return tasks.filter((t) => {
      const okSearch = !q || `${t.name} ${t.caseTitle}`.toLowerCase().includes(q);
      const okPriority = priorityFilter === 'All' || t.priority === priorityFilter;
      const okStatus = taskStatusFilter === 'All' || t.status === taskStatusFilter;
      return okSearch && okPriority && okStatus;
    });
  }, [tasks, search, priorityFilter, taskStatusFilter]);

  const list = tab === 'all' ? filteredCases : filteredTasks.filter((t) => t.status === 'Pending');
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const visible = list.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  /* Re-assign the lawyer on a case (dropdown inside each card). */
  const changeLawyer = async (caseId, lawyerId) => {
    if (!lawyerId) return;
    try {
      const lawyer = team.find((l) => l.id === lawyerId);
      // Only lawyer_id is sent: the backend rejects unknown fields like lawyer_name.
      await api.cases.update(caseId, { lawyer_id: lawyerId }, role);
      setCases((cs) => cs.map((c) => (c.id === caseId ? { ...c, lawyer_id: lawyerId, lawyer_name: lawyer?.fullName } : c)));
      toast('Lawyer updated.');
    } catch (err) {
      toast(`Failed to update lawyer: ${err.message}`, 'error');
    }
  };

  /* The lawyers shown in the per-card dropdown. */
  const [team, setTeam] = useState([]);
  useEffect(() => {
    api.users.getLawyers(user?.firmId, role)
      .then((l) => setTeam((Array.isArray(l) ? l : []).filter((u) => (u.role || '').toLowerCase() === 'lawyer')))
      .catch(() => {});
  }, [role, user?.firmId]);

  const pendingCount = tasks.filter((t) => t.status === 'Pending').length;

  return (
    <>
      <PageHeader title="Case List" subtitle={isLawyer ? 'All your assigned cases in the firm.' : 'All cases registered under your firm.'} />

      {/* Search + tabs + filters toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="!pl-9"
            placeholder={tab === 'all' ? 'Enter CNR to search cases' : 'Enter Task Name to search'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Tabs
          tabs={[
            { id: 'all', label: 'All Cases' },
            { id: 'pending', label: 'Pending Tasks', badge: pendingCount },
          ]}
          active={tab}
          onChange={(id) => { setTab(id); setSearch(''); setPage(1); }}
        />
        <FilterDropdown>
          {tab === 'all' ? (
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {['All', 'Active', 'Ongoing', 'Evidence Stage', 'Completed', 'Closed'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          ) : (
            <div className="space-y-3">
              <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                {['All', 'HIGH', 'MEDIUM', 'LOW'].map((s) => <option key={s}>{s}</option>)}
              </Select>
              <Select value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)}>
                {['All', 'Pending', 'Completed'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
          )}
        </FilterDropdown>
      </div>

      {loading && <Loading text="Loading cases…" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && visible.length === 0 && (
        <EmptyState icon="briefcase" title={`No ${tab === 'all' ? 'cases' : 'tasks'} match your search.`} />
      )}

      {/* ── Case cards ── */}
      {tab === 'all' && visible.map((c) => (
        <Card key={c.id} className="mb-4 flex flex-wrap items-center justify-between gap-4 p-5 transition hover:shadow-md"
          onClick={() => navigate(`/firm/cases/${c.id}`)}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={c.status || 'Active'} />
              <Badge>{c.case_type || c.title || 'Case'}</Badge>
            </div>
            <h3 className="mt-2 font-bold text-slate-900">{c.case_type || c.title}</h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <Icon name="clock" size={12} /> CNR: <span className="font-mono">{c.cnr || '—'}</span>
              {c.nextHearing?.date && <span className="ml-3 flex items-center gap-1"><Icon name="calendar" size={12} /> Next hearing: {c.nextHearing.date}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* inline lawyer reassignment (admin convenience) */}
            {!isLawyer && (
              <Select value={c.lawyer_id || c.lawyerId || ''} className="!w-44 !text-xs"
                onChange={(e) => changeLawyer(c.id, e.target.value)}>
                <option value="">Assign lawyer…</option>
                {team.map((l) => <option key={l.id} value={l.id}>{l.fullName || l.name}</option>)}
              </Select>
            )}
            <Button variant="outline" className="!text-xs" onClick={() => navigate(`/firm/cases/${c.id}`)}>
              View Details →
            </Button>
          </div>
        </Card>
      ))}

      {/* ── Task cards ── */}
      {tab === 'pending' && visible.map((t) => {
        const isToday = new Date(t.dueDate).toDateString() === new Date().toDateString();
        return (
          <Card key={t.id} className="mb-4 flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="amber">{t.status}</Badge>
                <Badge variant={t.priority === 'HIGH' ? 'red' : 'green'}>{t.priority}</Badge>
              </div>
              <h3 className="mt-2 font-bold text-slate-900">{t.name}</h3>
              <p className="mt-1 text-xs text-slate-500">
                Case: {t.caseTitle || 'General'} · Due:{' '}
                <span className={isToday ? 'font-bold text-red-500' : ''}>{fmtDate(t.dueDate)}</span>
              </p>
            </div>
            {t.caseCnr && (
              <Button variant="outline" className="!text-xs" onClick={() => navigate(`/firm/cases/${t.caseId || t.caseCnr}`)}>
                View Case
              </Button>
            )}
          </Card>
        );
      })}

      <Pagination page={safePage} pages={pages} total={list.length} perPage={PER_PAGE} onPage={setPage} />
    </>
  );
}

/* "dd MMM yyyy" date style used across the firm pages. */
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}