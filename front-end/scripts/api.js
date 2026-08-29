/**
 * LexFlow API Service
 * Central HTTP client for all backend calls.
 * Base URL: http://localhost:3000
 *
 * Usage:
 *   const cons = await LexFlowAPI.consultations.getMy(clientId, role);
 *   const created = await LexFlowAPI.consultations.create(data, role);
 */

const LexFlowAPI = (() => {
  'use strict';

  const BASE_URL = 'http://localhost:3000';

  // ── CSRF token cache ──────────────────────────────────────────────────────
  // Fetched once on first mutating request, then reused.
  // On a 403 "invalid csrf token" the cache is busted and one retry is made.
  let _csrfToken = null;
  let _csrfFetchPromise = null;

  async function fetchCsrfToken(force = false) {
    if (!force && _csrfToken) return _csrfToken;
    // Deduplicate concurrent fetches
    if (!force && _csrfFetchPromise) return _csrfFetchPromise;

    _csrfFetchPromise = fetch(`${BASE_URL}/csrf-token`, {
      method: 'GET',
      credentials: 'include',  // needed so the CSRF cookie is set
    })
      .then(res => res.json())
      .then(data => {
        _csrfToken = data.csrfToken || null;
        _csrfFetchPromise = null;
        return _csrfToken;
      })
      .catch(() => {
        _csrfFetchPromise = null;
        return null;  // graceful fallback
      });

    return _csrfFetchPromise;
  }

  /**
   * Core fetch wrapper — injects role + content-type headers,
   * automatically attaches x-csrf-token on mutating requests,
   * throws a structured error on non-2xx responses.
   *
   * On a 403 "invalid csrf token" the cached token is busted and the
   * request is retried once with a fresh token (handles cookie rotation /
   * session reset without requiring a full page reload).
   */
  async function request(method, path, { body, role, extraHeaders = {}, _isRetry = false } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (role) headers['role'] = role;

    // Attach CSRF token for mutating methods
    const mutating = /^(POST|PUT|PATCH|DELETE)$/i.test(method);
    if (mutating) {
      const token = await fetchCsrfToken();
      if (token) headers['x-csrf-token'] = token;
    }

    const opts = { method, headers, credentials: 'include' };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, opts);

    // Parse body (may be empty for 204)
    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    }

    // ── Stale CSRF token retry ───────────────────────────────────────────────
    // csurf now returns 403 (Forbidden). If we get a 403 on a mutating request,
    // bust the cache, fetch a fresh token, and replay exactly once.
    if (res.status === 403 && !_isRetry && mutating) {
      _csrfToken = null; // bust cache
      await fetchCsrfToken(true); // force fresh fetch
      return request(method, path, { body, role, extraHeaders, _isRetry: true });
    }

    if (!res.ok) {
      const message =
        data?.message ||
        (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
        `HTTP ${res.status}`;
      const err = new Error(Array.isArray(message) ? message.join(', ') : message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  /**
   * Fetch wrapper for callers that bypass request() (FormData uploads,
   * page-local API clients). Attaches the CSRF token on mutating methods and
   * retries once with a fresh token on a 403 "invalid csrf token".
   * Returns the raw Response.
   */
  async function secureFetch(url, { method = 'GET', body, role, headers = {}, _isRetry = false } = {}) {
    const h = { ...headers };
    if (role) h['role'] = role;

    const mutating = /^(POST|PUT|PATCH|DELETE)$/i.test(method);
    if (mutating) {
      const token = await fetchCsrfToken();
      if (token) h['x-csrf-token'] = token;
    }

    const opts = { method, headers: h, credentials: 'include' };
    if (body !== undefined) opts.body = body;

    const res = await fetch(url, opts);

    if (res.status === 403 && !_isRetry && mutating) {
      _csrfToken = null;          // bust stale cache
      await fetchCsrfToken(true); // force fresh fetch
      return secureFetch(url, { method, body, role, headers, _isRetry: true });
    }
    return res;
  }

  // ── Helper to get current user & role from localStorage ──────────────────
  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch {
      return null;
    }
  }

  function getRole() {
    const user = getCurrentUser();
    return user?.role || null;
  }

  // ── Consultations namespace ───────────────────────────────────────────────
  const consultations = {
    /**
     * GET /consultations/my
     * Client: fetch own consultations
     * @param {string} clientId  - The current client's user ID
     * @param {string} role      - Should be "client"
     */
    getMy(clientId, role) {
      return request('GET', '/consultations/my', {
        role,
        extraHeaders: { 'x-client-id': clientId },
      });
    },

    /**
     * GET /consultations
     * FirmAdmin/Lawyer: fetch all with optional filters
     * @param {{ clientId?, firmId?, status?, lawyerId? }} filters
     * @param {string} role
     */
    getAll(filters = {}, role) {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { 
        if (v !== undefined && v !== null) qs.set(k, v); 
      });
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request('GET', `/consultations${query}`, { role });
    },

    /**
     * GET /consultations/:id
     * All roles
     */
    getById(id, role) {
      return request('GET', `/consultations/${id}`, { role });
    },

    /**
     * POST /consultations
     * Client creates a new booking
     * @param {Object} data  - CreateConsultationDto shape
     * @param {string} role  - "client"
     */
    create(data, role) {
      return request('POST', '/consultations', { body: data, role });
    },

    /**
     * PATCH /consultations/:id
     * FirmAdmin/Lawyer: assign lawyer, change status, add notes
     */
    update(id, data, role) {
      return request('PATCH', `/consultations/${id}`, { body: data, role });
    },

    /**
     * PATCH /consultations/:id/cancel
     * Client or FirmAdmin: cancel a consultation
     */
    cancel(id, role) {
      return request('PATCH', `/consultations/${id}/cancel`, { role });
    },

    /**
     * DELETE /consultations/:id
     * FirmAdmin/SuperAdmin only
     */
    remove(id, role) {
      return request('DELETE', `/consultations/${id}`, { role });
    },

    /**
     * GET /consultations/workflow-bookings
     * FirmAdmin/SuperAdmin: who booked via the search workflow
     */
    getWorkflowBookings(role) {
      return request('GET', '/consultations/workflow-bookings', { role });
    },
  };

  // ── Users namespace (for any cross-module needs) ──────────────────────────
  const users = {
    getAll(filters = {}, role) {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { 
        if (v !== undefined && v !== null) qs.set(k, v); 
      });
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request('GET', `/users${query}`, { role });
    },
    getAllFirms(role) {
      return request('GET', '/users/firms/all', { role });
    },
    getById(id, role) {
      return request('GET', `/users/${id}`, { role });
    },
    getLawyers(firmId, role) {
      const query = firmId ? `?firmId=${firmId}` : '';
      return request('GET', `/users/lawyers${query}`, { role });
    },
  };



  // ── Cases namespace ──────────────────────────────────────────────────────────
  const cases = {
    getAll(filters = {}, role) {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { 
        if (v !== undefined && v !== null) qs.set(k, v); 
      });
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request('GET', `/cases${query}`, { role });
    },
    getById(id, role) {
      return request('GET', `/cases/${id}`, { role });
    },
    create(data, role) {
      return request('POST', '/cases', { body: data, role });
    },
    update(id, data, role) {
      return request('PATCH', `/cases/${id}`, { body: data, role });
    },
    remove(id, role) {
      return request('DELETE', `/cases/${id}`, { role });
    },
  };

  // ── Tasks namespace ───────────────────────────────────────────────────────
  const tasks = {
    getAll(filters = {}, role) {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { 
        if (v !== undefined && v !== null) qs.set(k, v); 
      });
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request('GET', `/tasks${query}`, { role });
    },
    getById(id, role) {
      return request('GET', `/tasks/${id}`, { role });
    },
    create(data, role) {
      return request('POST', '/tasks', { body: data, role });
    },
    update(id, data, role) {
      return request('PATCH', `/tasks/${id}`, { body: data, role });
    },
    remove(id, role) {
      return request('DELETE', `/tasks/${id}`, { role });
    },
  };

  // ── Law Firms namespace ───────────────────────────────────────────────────
  const lawFirms = {
    /**
     * GET /law-firms
     * Client: search/filter law firms
     * @param {{ keyword?, location?, practiceArea?, sortBy? }} filters
     * @param {string} role - should be "client"
     */
    getAll(filters = {}, role) {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { 
        if (v !== undefined && v !== null) qs.set(k, v); 
      });
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request('GET', `/law-firms${query}`, { role });
    },

    /**
     * GET /law-firms/:id
     * Client: get full profile of a single firm
     * @param {string} id - firm ID e.g. 'firm-001'
     * @param {string} role
     */
    getById(id, role) {
      return request('GET', `/law-firms/${id}`, { role });
    },
  };

  // ── Auth namespace ──────────────────────────────────────────────────────────
  const auth = {
    login(email, password, role) {
      return request('POST', '/users/login', { body: { email, password, role } });
    },
  };

  // Public interface
  return {
    auth, consultations, users, cases, tasks, lawFirms,
    getCurrentUser, getRole, BASE_URL,
    getCsrfToken: fetchCsrfToken,
    clearCsrfToken: () => { _csrfToken = null; },
    secureFetch,
  };

})();

// Make globally available
window.LexFlowAPI = LexFlowAPI;

