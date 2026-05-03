// LexFlow Cases Storage Module — API-first, role-based data isolation
// All case data comes from the NestJS backend REST API.
// The correct filter (firmId / clientId / lawyerId) is automatically applied
// based on the logged-in user's role and identity.
//
// Role isolation rules (enforced both here and on the backend):
//   firmadmin / intern  →  ?firmId=<user.firmId>
//   lawyer              →  ?lawyerId=<user.id>    (also scoped to firm)
//   client              →  ?clientId=<user.id>
//   superadmin          →  no filter (sees all)
//
// Public API mirrors the old localStorage module so every page
// can call  casesStorage.getCases()  without any changes.

window.LexFlowCasesStorage = (function () {
  'use strict';

  const API_BASE_URL = 'http://127.0.0.1:3000';

  // ─── Auth helpers ────────────────────────────────────────────────────────────

  /** Return the currently logged-in user object from localStorage, or null. */
  function getCurrentUser() {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Build the role header value for the current user.
   * Falls back to 'client' so the request is never completely anonymous.
   */
  function getRoleHeader() {
    const user = getCurrentUser();
    if (!user || !user.role) return 'client';
    // Normalise: the backend enum uses lowercase ('firmadmin', 'lawyer' …)
    return user.role.toLowerCase().replace('firmadmin', 'firmadmin');
  }

  /**
   * Build query-string parameters that scope the cases to the logged-in user.
   * Returns a string like "?firmId=firm-1" or "" for superadmin.
   */
  function buildCaseQueryParams() {
    const user = getCurrentUser();
    if (!user) return '';

    const role = (user.role || '').toLowerCase();
    const params = new URLSearchParams();

    if (role === 'client') {
      // Client sees only their own cases
      params.append('clientId', user.id);
    } else if (role === 'lawyer') {
      // Lawyer sees cases assigned to them
      params.append('lawyerId', user.id);
    } else if (role === 'firmadmin' || role === 'intern') {
      // Firm Admin and Interns see all cases belonging to their firm
      if (user.firmId) params.append('firmId', user.firmId);
    }
    // superadmin → no params → backend returns all cases

    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  // ─── Base fetch helper ───────────────────────────────────────────────────────

  async function apiFetch(path, options = {}) {
    const url = `${API_BASE_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'role': getRoleHeader(),
      ...(options.headers || {}),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || msg; } catch {}
      throw new Error(msg);
    }

    try { return await res.json(); } catch { return undefined; }
  }

  // ─── Public case CRUD (hits NestJS API) ──────────────────────────────────────
  
  /**
   * Fetch cases for the current user (role-scoped automatically).
   * This is the primary method used by all case list pages.
   */
  async function getCases() {
    try {
      const qs = buildCaseQueryParams();
      return await apiFetch(`/cases${qs}`);
    } catch (err) {
      console.error('[LexFlowCasesStorage] getCases failed:', err);
      return [];
    }
  }

  /** Alias used by pages that call fetchCases() directly. */
  async function fetchCases() {
    return getCases();
  }

  /** Fetch a single case by its numeric ID. */
  async function getCaseById(id) {
    try {
      return await apiFetch(`/cases/${id}`);
    } catch (err) {
      console.error('[LexFlowCasesStorage] getCaseById failed:', err);
      return null;
    }
  }

  /** Fetch a single case by CNR (client-side search over getCases result). */
  async function getCaseByCnr(cnr) {
    const cases = await getCases();
    return cases.find(c => String(c.cnr) === String(cnr)) || null;
  }

  /** Create a new case on the backend. */
  async function createCase(dto) {
    return apiFetch('/cases', { method: 'POST', body: JSON.stringify(dto) });
  }

  /** Update an existing case. */
  async function updateCase(id, dto) {
    return apiFetch(`/cases/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
  }

  /** Delete a case. */
  async function deleteCase(id) {
    return apiFetch(`/cases/${id}`, { method: 'DELETE' });
  }

  // ─── Tasks & Users (Stubs for future API migration) ──────────────────────────

  async function getTasks() {
    // TODO: Migrate to NestJS /tasks
    return [];
  }

  async function getUsers(role) {
    const query = role ? `?role=${role}` : '';
    return apiFetch(`/users${query}`);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  return {
    getCases,
    fetchCases,
    getCaseById,
    getCaseByCnr,
    createCase,
    updateCase,
    deleteCase,

    // Legacy stubs (kept to avoid breakage, but now return empty)
    saveCases: async () => {},
    getTasks,
    saveTasks: async () => {},
    getUsers,
    saveUsers: async () => {},

    getCurrentUser,
    getRoleHeader,
  };
})();
