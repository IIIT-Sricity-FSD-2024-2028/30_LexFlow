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

  // --- GLOBAL FETCH OVERRIDE ---
  // Ensure that all raw fetch() calls in the app send cookies across different ports
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let [resource, config] = args;
    if (!config) config = {};
    if (config.credentials === undefined) {
      config.credentials = 'include';
    }
    // JWT: attach the stored token to every request that doesn't set its own.
    const token = localStorage.getItem('access_token');
    if (token) {
      if (!config.headers) config.headers = {};
      if (config.headers instanceof Headers) {
        if (!config.headers.has('Authorization')) config.headers.set('Authorization', 'Bearer ' + token);
      } else if (!config.headers['Authorization']) {
        config.headers['Authorization'] = 'Bearer ' + token;
      }
    }
    return originalFetch(resource, config);
  };
  // -----------------------------

  // Use the same hostname as the frontend to prevent "cross-site" cookie warnings
  // (e.g. if frontend is 127.0.0.1, backend is 127.0.0.1:3000)
  const BASE_URL = `http://${window.location.hostname}:3000`;

  /**
   * Core fetch wrapper — injects role + content-type headers,
   * throws a structured error on non-2xx responses.
   */
  /**
   * Read the double-submit CSRF cookie the backend sets on every safe request.
   * The backend only enforces it once a session cookie is in play, but sending
   * it always means state-changing calls keep working if that ever turns on.
   */
  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)x-csrf-token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function request(method, path, { body, role, extraHeaders = {} } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (role) headers['role'] = role;

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrf = getCsrfToken();
      if (csrf) headers['x-csrf-token'] = csrf;
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
    create(body, role) {
      return request('POST', '/users', { body, role });
    },
    update(id, body, role) {
      return request('PUT', `/users/${id}`, { body, role });
    },
    remove(id, role) {
      return request('DELETE', `/users/${id}`, { role });
    },
    /** Superadmin: create a law firm, optionally with its admin account. */
    createFirm(body, role) {
      return request('POST', '/users/firms', { body, role });
    },
    /** Superadmin: patch a law firm, including its tier. */
    updateFirm(firmId, body, role) {
      return request('PUT', `/users/firms/${firmId}`, { body, role });
    },
    /** Superadmin: delete a law firm. Pass cascade to remove its members too. */
    deleteFirm(firmId, role, cascade = false) {
      const query = cascade ? '?cascade=true' : '';
      return request('DELETE', `/users/firms/${firmId}${query}`, { role });
    },
    updateFirmTier(firmId, tier, role) {
      return request('PUT', `/users/firms/${firmId}/tier`, { body: { tier }, role });
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

  // ── Billing namespace ───────────────────────────────────────────────────────
  const billing = {
    getInvoices(role, extraHeaders = {}) {
      return request('GET', '/billing/invoices', { role, extraHeaders });
    },
    getInvoice(id, role) {
      return request('GET', `/billing/invoices/${id}`, { role });
    },
    updateInvoice(id, body, role) {
      return request('PATCH', `/billing/invoices/${id}`, { body, role });
    },
    deleteInvoice(id, role) {
      return request('DELETE', `/billing/invoices/${id}`, { role });
    },
    getPayments(role, extraHeaders = {}) {
      return request('GET', '/billing/payments', { role, extraHeaders });
    },
  };

  // ── Platform namespace (superadmin only) ────────────────────────────────────
  // The platform owner's own business: what LexFlow earns from the law firms
  // that use it, through tier subscriptions and invoice commission.
  const platform = {
    /** Headline earnings: MRR, ARR, lifetime, this month vs last. */
    getRevenueSummary(role) {
      return request('GET', '/platform/revenue/summary', { role });
    },
    /** Month-by-month earnings series for the dashboard chart. */
    getMonthlyRevenue(months = 6, role) {
      return request('GET', `/platform/revenue/monthly?months=${months}`, { role });
    },
    /** Per-firm earnings breakdown. */
    getRevenueByFirm(role) {
      return request('GET', '/platform/revenue/by-firm', { role });
    },
    getSubscriptions(role) {
      return request('GET', '/platform/subscriptions', { role });
    },
    /**
     * One firm's subscription. Superadmin may look up any firm; a firmadmin
     * caller is scoped server-side to their own (pass their user id).
     */
    getSubscription(firmId, role, callerId) {
      const extraHeaders = callerId ? { 'x-user-id': callerId } : {};
      return request('GET', `/platform/subscriptions/${firmId}`, { role, extraHeaders });
    },
    /** Superadmin only: change a firm's tier or status immediately, free of charge. */
    updateSubscription(firmId, body, role) {
      return request('PATCH', `/platform/subscriptions/${firmId}`, { body, role });
    },
    /**
     * Request a plan change. Issues a one-time charge for the new tier — the
     * firm stays on its current plan until that charge is paid. Requesting
     * the current tier again cancels a pending request. A firmadmin caller
     * is scoped to their own firm (pass their user id).
     */
    requestTierChange(firmId, tier, role, callerId) {
      const extraHeaders = callerId ? { 'x-user-id': callerId } : {};
      return request('POST', `/platform/subscriptions/${firmId}/tier-change`, { body: { tier }, role, extraHeaders });
    },
    /**
     * Subscription charges LexFlow raises against each firm, one per month.
     * Superadmin sees every firm (optionally filtered by firmId); a firmadmin
     * caller is scoped server-side to their own firm, so pass their user id.
     */
    getCharges(role, firmId, callerId) {
      const query = firmId ? `?firmId=${firmId}` : '';
      const extraHeaders = callerId ? { 'x-user-id': callerId } : {};
      return request('GET', `/platform/charges${query}`, { role, extraHeaders });
    },
    /**
     * Superadmin may set any status; a firmadmin caller may only mark Paid,
     * and only their own firm's charge (pass their user id as callerId).
     */
    updateChargeStatus(id, status, role, callerId) {
      const extraHeaders = callerId ? { 'x-user-id': callerId } : {};
      return request('PATCH', `/platform/charges/${id}`, { body: { status }, role, extraHeaders });
    },
    getTierPlans(role) {
      return request('GET', '/platform/tiers', { role });
    },
    updateTierPricing(tier, monthlyPrice, role) {
      return request('PUT', `/platform/tiers/${tier}`, { body: { monthlyPrice }, role });
    },
    getSettings(role) {
      return request('GET', '/platform/settings', { role });
    },
    updateSettings(body, role) {
      return request('PUT', '/platform/settings', { body, role });
    },
  };

  // ── Auth namespace ──────────────────────────────────────────────────────────
  const auth = {
    async login(email, password, role) {
      const data = await request('POST', '/users/login', { body: { email, password, role } });
      // New backend returns { access_token, user }; store the token for the
      // fetch override and hand back the user object callers already expect.
      if (data && data.access_token) {
        try { localStorage.setItem('access_token', data.access_token); } catch {}
        return data.user ?? data;
      }
      return data;
    },
  };

  // Public interface
  return { auth, consultations, users, cases, tasks, lawFirms, billing, platform, getCurrentUser, getRole, BASE_URL };

})();

// Make globally available
window.LexFlowAPI = LexFlowAPI;

