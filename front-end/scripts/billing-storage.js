/**
 * billing-storage.js — API client for LexFlow Billing
 * Replaces all localStorage CRUD from the old billing-storage.js.
 *
 * Reads from sessionStorage/localStorage currentUser JSON:
 *   currentUser.id       → sent as x-user-id  (for role-scoped filtering)
 *   currentUser.fullName → sent as x-user-name (for LAWYER scoping fallback)
 * window.LEXFLOW_ROLE    → set by each HTML page before this script loads
 */
(function () {
  const BASE = 'http://localhost:3000';

  function getCurrentUser() {
    try {
      const raw = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function getHeaders(extra = {}) {
    const user = getCurrentUser();
    return {
      'Content-Type':  'application/json',
      'role':          (window.LEXFLOW_ROLE || 'CLIENT'),
      'x-user-id':     user.id   || '',
      'x-user-name':   user.fullName || user.name || '',
      ...extra,
    };
  }

  async function apiFetch(path, options = {}) {
    const res  = await fetch(`${BASE}${path}`, {
      ...options,
      headers: getHeaders(options.headers || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message
        || (Array.isArray(json?.errors) ? json.errors.join(', ') : null)
        || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json.data ?? json;
  }

  // ── Client dropdown ─────────────────────────────────────────────────────────
  // Returns [{ id, fullName, email }] — only role=client users
  async function fetchClients()              { return apiFetch('/billing/clients'); }

  // ── Invoice API ─────────────────────────────────────────────────────────────
  async function fetchInvoices()             { return apiFetch('/billing/invoices'); }
  async function fetchSummary()              { return apiFetch('/billing/invoices/summary'); }
  async function fetchInvoice(id)            { return apiFetch(`/billing/invoices/${id}`); }
  async function createInvoice(dto)          { return apiFetch('/billing/invoices',     { method: 'POST',  body: JSON.stringify(dto) }); }
  async function updateInvoice(id, dto)      { return apiFetch(`/billing/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }); }
  async function deleteInvoice(id)           { return apiFetch(`/billing/invoices/${id}`, { method: 'DELETE' }); }

  // ── Payment API ─────────────────────────────────────────────────────────────
  async function fetchPayments()             { return apiFetch('/billing/payments'); }
  async function fetchPaymentsByInvoice(id)  { return apiFetch(`/billing/payments/invoice/${id}`); }
  async function recordPayment(invoiceId, paymentMethod) {
    return apiFetch(`/billing/payments/${invoiceId}`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
  }

  window.LexFlowBillingStorage = {
    fetchClients,
    fetchInvoices,
    fetchSummary,
    fetchInvoice,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    fetchPayments,
    fetchPaymentsByInvoice,
    recordPayment,
  };
})();
