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

  /**
   * Core fetch wrapper — injects role + content-type headers,
   * throws a structured error on non-2xx responses.
   */
  async function request(method, path, { body, role, extraHeaders = {} } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (role) headers['role'] = role;

    const opts = { method, headers };
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
      Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
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
      Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request('GET', `/users${query}`, { role });
    },
    getById(id, role) {
      return request('GET', `/users/${id}`, { role });
    },
  };

  // ── Cases namespace ──────────────────────────────────────────────────────────
  const cases = {
    getAll(filters = {}, role) {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
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

  // Public interface
  return { consultations, users, cases, getCurrentUser, getRole, BASE_URL };
})();

// Make globally available
window.LexFlowAPI = LexFlowAPI;
