/**
 * api/api.js - The single HTTP client for the whole app.
 *
 * In the vanilla app this logic lived in scripts/api.js, scripts/billing-storage.js
 * and scripts/cases-storage.js. Here it is combined into ONE clean module that
 * every page imports. Each backend endpoint is exposed as a small named function
 * so pages read like:  api.consultations.getMy(...)  etc.
 *
 * Auth model (same as vanilla):
 *  - JWT access token is stored in localStorage under "access_token"
 *    and sent on authenticated requests as Authorization: Bearer <token>.
 *  - A "role" header tells the backend which role is asking.
 *  - For state-changing requests we re-send the "x-csrf-token" cookie value
 *    as a header (double-submit CSRF pattern the backend expects).
 *  - credentials: 'include' keeps the session cookie flowing.
 */

// Remove data and sessions left by the retired browser demo store.
if (typeof window !== 'undefined') {
  for (const key of ['lexflow_users', 'lexflow_firms', 'lexflow_cases', 'lexflow_consultations', 'lexflow_store_seeded']) {
    localStorage.removeItem(key);
  }
  const token = localStorage.getItem('access_token');
  if (!token || token.startsWith('demo_jwt_')) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userRole');
  }
}

// Base URL for every backend call.
// In dev, vite.config.js proxies "/api" -> "http://localhost:3000", so we can
// use a relative path and never have CORS trouble.
export const BASE_URL = '/api';
export const SESSION_EXPIRED_EVENT = 'lexflow:session-expired';

/** Read the CSRF cookie the backend sets. Returns null when absent. */
function getCsrfToken() {
  // Cookies look like "name1=value1; name2=value2" - find ours with a regex.
  const match = document.cookie.match(/(?:^|;\s*)x-csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Read + parse the signed-in user object saved by the login page. */
export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || 'null');
  } catch {
    return null; // corrupted JSON -> treat as "not logged in"
  }
}

/** The signed-in user's role in lowercase ("client", "firmadmin", ...). */
export function getRole() {
  const user = getCurrentUser();
  return (user?.role || '').toLowerCase() || null;
}

/**
 * Low-level request helper used by every endpoint below.
 * @param {string} method  HTTP verb: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
 * @param {string} path    backend path, e.g. "/consultations"
 * @param {object} opts    { body, role, extraHeaders, formData, authenticate }
 * @returns parsed JSON (or null for empty responses)
 * @throws Error with .status and .data when the backend answers non-2xx
 */
async function request(method, path, { body, role, extraHeaders = {}, formData, authenticate = true } = {}) {
  // Start building headers. Content-Type is skipped for FormData - the browser
  // must generate it itself so it can add the multipart boundary.
  const headers = { ...extraHeaders };
  if (!formData) headers['Content-Type'] = 'application/json';
  // Every request carries the role header so the backend can scope the query.
  if (role) headers['role'] = role;
  // Attach the JWT (if the user has logged in).
  const token = authenticate ? localStorage.getItem('access_token') : null;
  if (token) headers['Authorization'] = 'Bearer ' + token;
  // Double-submit CSRF: send the cookie's value back as a header on mutations.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers['x-csrf-token'] = csrf;
  }

  // Build the fetch options. credentials:'include' sends/receives cookies.
  const options = { method, headers, credentials: 'include' };
  if (formData) options.body = formData;                       // file uploads
  else if (body !== undefined) options.body = JSON.stringify(body); // JSON calls

  // Perform the request.
  const res = await fetch(`${BASE_URL}${path}`, options);

  // Parse the body - may be empty (204) or not JSON at all.
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) data = await res.json();
  else if (!res.ok) data = { message: await res.text().catch(() => '') };

  // Turn HTTP errors into JS exceptions the pages can catch + show.
  if (!res.ok) {
    if (res.status === 401 && token && token === localStorage.getItem('access_token')) {
      localStorage.removeItem('access_token');
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    let message = data?.message || `HTTP ${res.status}`;
    // Backend sometimes sends message as an array of validation errors.
    if (Array.isArray(message)) message = message.join(', ');
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  // Many backend responses wrap the payload in { data: ... } - unwrap it.
  if (data && typeof data === 'object' && 'data' in data && data.data !== undefined) {
    return data.data;
  }
  return data;
}

/* Small helper: turn {a:1, b:2} into "a=1&b=2" skipping empty values. */
function toQuery(filters = {}) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/* ────────────────────────────────  ENDPOINTS  ──────────────────────────────── */

export const api = {
  /* AUTH: login is the only public endpoint. Stores token + returns the user. */
  auth: {
    async login(email, password) {
      const data = await request('POST', '/users/login', {
        body: { email, password },
        authenticate: false,
      });
      if (!data?.access_token || !data?.user) {
        throw new Error('The server did not return a valid sign-in session.');
      }
      localStorage.setItem('access_token', data.access_token);
      return data.user;
    },
  },

  /* CONSULTATIONS: bookings made by clients, managed by firms. */
  consultations: {
    // Client: my own bookings. Backend wants the client id in a header.
    getMy(clientId, role) {
      return request('GET', '/consultations/my', { role, extraHeaders: { 'x-client-id': clientId } });
    },
    // Firm/superadmin: list with optional filters { firmId, status, lawyerId... }
    getAll(filters, role) {
      return request('GET', `/consultations${toQuery(filters)}`, { role });
    },
    // Who booked through the landing-page workflow.
    getWorkflowBookings(role) {
      return request('GET', '/consultations/workflow-bookings', { role });
    },
    // One consultation by id.
    getById(id, role) {
      return request('GET', `/consultations/${id}`, { role });
    },
    // Client creates a booking from the law-firm search page.
    create(data, role) {
      return request('POST', '/consultations', { body: data, role });
    },
    // Firm staff: assign lawyer / change status / add notes.
    update(id, data, role) {
      return request('PATCH', `/consultations/${id}`, { body: data, role });
    },
    // Client or firm: cancel a booking (no body needed).
    cancel(id, role) {
      return request('PATCH', `/consultations/${id}/cancel`, { role });
    },
    // Superadmin: permanently remove a booking.
    remove(id, role) {
      return request('DELETE', `/consultations/${id}`, { role });
    },
  },

  /* USERS: accounts of every kind + law firms + firm onboarding wizard. */
  users: {
    getAll(filters, role) {
      return request('GET', `/users${toQuery(filters)}`, { role });
    },
    getById(id, role) {
      return request('GET', `/users/${id}`, { role });
    },
    // All members of one firm (firm user-management page).
    getByFirm(firmId, role) {
      return request('GET', `/users/firm/${firmId}`, { role });
    },
    // Lawyers of a firm - used for assignment dropdowns + sidebar tier badge.
    getLawyers(firmId, role) {
      return request('GET', `/users/lawyers${toQuery({ firmId })}`, { role });
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

    /* ── Firm onboarding wizard (3 steps) ── */
    startOnboarding() {
      return request('POST', '/users/firm-onboarding/start', { role: 'firmadmin' });
    },
    onboardingStep1(sessionId, body) {
      return request('POST', `/users/firm-onboarding/step1/${sessionId}`, { body, role: 'firmadmin' });
    },
    onboardingStep2(sessionId, body) {
      return request('POST', `/users/firm-onboarding/step2/${sessionId}`, { body, role: 'firmadmin' });
    },
    // Returns { adminUserId, firmId } and signs the admin in server-side.
    onboardingStep3(sessionId, body) {
      return request('POST', `/users/firm-onboarding/step3/${sessionId}`, { body, role: 'firmadmin' });
    },

    /* ── Superadmin: manage firms directly ── */
    createFirm(body) {
      return request('POST', '/users/firms', { body, role: 'superadmin' });
    },
    updateFirm(firmId, body) {
      return request('PUT', `/users/firms/${firmId}`, { body, role: 'superadmin' });
    },
    // cascade=true also deletes the firm's members (backend returns 400 first).
    deleteFirm(firmId, cascade = false) {
      return request('DELETE', `/users/firms/${firmId}${cascade ? '?cascade=true' : ''}`, { role: 'superadmin' });
    },
  },

  /* CASES: legal cases created from consultations. */
  cases: {
    getAll(filters, role) {
      return request('GET', `/cases${toQuery(filters)}`, { role });
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
  },

  /* TASKS: to-dos assigned inside a firm. */
  tasks: {
    getAll(filters, role) {
      return request('GET', `/tasks${toQuery(filters)}`, { role });
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
  },

  /* LAW FIRMS: public directory used by the client search page. */
  lawFirms: {
    getAll(filters, role) {
      return request('GET', `/law-firms${toQuery(filters)}`, { role });
    },
    getById(id, role) {
      return request('GET', `/law-firms/${id}`, { role });
    },
  },

  /* BILLING: invoices (firm -> client) and payments. */
  billing: {
    getCases(role) {
      return request('GET', '/billing/cases', { role });
    },
    // extraHeaders carry x-user-id / x-user-name exactly like the vanilla client.
    getInvoices(role, extraHeaders = {}) {
      return request('GET', '/billing/invoices', { role, extraHeaders });
    },
    getInvoice(id, role, extraHeaders = {}) {
      return request('GET', `/billing/invoices/${id}`, { role, extraHeaders });
    },
    createInvoice(body, role, extraHeaders = {}) {
      return request('POST', '/billing/invoices', { body, role, extraHeaders });
    },
    updateInvoice(id, body, role, extraHeaders = {}) {
      return request('PATCH', `/billing/invoices/${id}`, { body, role, extraHeaders });
    },
    deleteInvoice(id, role, extraHeaders = {}) {
      return request('DELETE', `/billing/invoices/${id}`, { role, extraHeaders });
    },
    getPayments(role, extraHeaders = {}) {
      return request('GET', '/billing/payments', { role, extraHeaders });
    },
    // Client pays an invoice: card, UPI, net banking...
    recordPayment(invoiceId, paymentMethod, role, extraHeaders = {}) {
      return request('POST', `/billing/payments/${invoiceId}`, { body: { paymentMethod }, role, extraHeaders });
    },
    // Clients linked to a firm - used to fill the "bill to" dropdown.
    getClients(role, extraHeaders = {}) {
      return request('GET', '/billing/clients', { role, extraHeaders });
    },
  },

  /* PLATFORM: LexFlow's own business (superadmin) + firm subscriptions. */
  platform: {
    getRevenueSummary(role) {
      return request('GET', '/platform/revenue/summary', { role });
    },
    getMonthlyRevenue(months, role) {
      return request('GET', `/platform/revenue/monthly?months=${months}`, { role });
    },
    getRevenueByFirm(role) {
      return request('GET', '/platform/revenue/by-firm', { role });
    },
    getSubscriptions(role) {
      return request('GET', '/platform/subscriptions', { role });
    },
    getSubscription(firmId, role, callerId) {
      return request('GET', `/platform/subscriptions/${firmId}`, {
        role, extraHeaders: callerId ? { 'x-user-id': callerId } : {},
      });
    },
    requestTierChange(firmId, tier, role, callerId) {
      return request('POST', `/platform/subscriptions/${firmId}/tier-change`, {
        body: { tier }, role, extraHeaders: callerId ? { 'x-user-id': callerId } : {},
      });
    },
    prepareRenewal(firmId, role) {
      return request('POST', '/platform/subscriptions/' + firmId + '/renew', { role });
    },
    updateRenewal(firmId, changes, role) {
      return request('PATCH', '/platform/subscriptions/' + firmId + '/renewal', { body: changes, role });
    },
    getCharges(role, firmId, callerId) {
      return request('GET', `/platform/charges${toQuery({ firmId })}`, {
        role, extraHeaders: callerId ? { 'x-user-id': callerId } : {},
      });
    },
    updateChargeStatus(id, status, role, callerId, paymentMethod) {
      return request('PATCH', `/platform/charges/${id}`, {
        body: { status, paymentMethod }, role, extraHeaders: callerId ? { 'x-user-id': callerId } : {},
      });
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
  },

  /* DOCUMENTS: per-case file storage + the audit trail of who did what. */
  documents: {
    listByCase(caseId, role, email) {
      return request('GET', `/documents${toQuery({ caseId })}`, {
        role, extraHeaders: { 'x-user-email': email || '' },
      });
    },
    // Multipart upload - extra carries { caseId, type, access, version... }.
    upload(file, meta, role, email) {
      const fd = new FormData(); // FormData builds multipart/form-data for us
      Object.entries(meta).forEach(([k, v]) => fd.append(k, v));
      fd.append('file', file);
      return request('POST', '/documents', {
        formData: fd, role, extraHeaders: { 'x-user-email': email || '' },
      });
    },
    // Update = new version of the file + new access level / name.
    update(id, file, meta, role, email) {
      const fd = new FormData();
      Object.entries(meta).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('file', file);
      return request('PATCH', `/documents/${id}`, {
        formData: fd, role, extraHeaders: { 'x-user-email': email || '' },
      });
    },
    remove(id, role, email) {
      return request('DELETE', `/documents/${id}`, {
        role, extraHeaders: { 'x-user-email': email || '' },
      });
    },
    // Audit trail entries for one case (or all cases when caseId is empty).
    getActivity(caseId, role, email) {
      return request('GET', `/documents/activity${toQuery({ caseId })}`, {
        role, extraHeaders: { 'x-user-email': email || '' },
      });
    },
    // Write one audit entry (called on view/download/upload/update/delete).
    logActivity(entry, role, email) {
      return request('POST', '/documents/activity', {
        body: entry, role, extraHeaders: { 'x-user-email': email || '' },
      }).catch(() => {}); // logging must never break the page
    },
  },
};
