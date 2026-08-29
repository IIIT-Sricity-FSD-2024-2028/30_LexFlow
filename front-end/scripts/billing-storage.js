(function () {

  const BASE = "http://localhost:3000";

  function getCurrentUser() {
    try {
      const raw =
        sessionStorage.getItem("currentUser") ||
        localStorage.getItem("currentUser");

      if (!raw) return {};
      return JSON.parse(raw);

    } catch {
      return {};
    }
  }

  function getHeaders(extra = {}) {

    const user = getCurrentUser();

    return {
      "Content-Type": "application/json",
      role: window.LEXFLOW_ROLE || "CLIENT",
      "x-user-id": user.id || "",
      "x-user-name": user.fullName || user.name || "",
      ...extra,
    };
  }

  async function apiFetch(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    const res = await window.LexFlowAPI.secureFetch(`${BASE}${path}`, {
      method,
      headers: getHeaders(options.headers || {}),
      body: options.body,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        json?.message ||
        (Array.isArray(json?.errors) ? json.errors.join(", ") : null) ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return json.data ?? json;
  }

  // ── CLIENTS ─────────────────────────────

  async function fetchClients() {
    return apiFetch("/billing/clients");
  }

  // ── INVOICES ────────────────────────────

  async function fetchInvoices() {
    return apiFetch("/billing/invoices");
  }

  async function fetchSummary() {
    return apiFetch("/billing/invoices/summary");
  }

  async function fetchInvoice(id) {
    return apiFetch(`/billing/invoices/${id}`);
  }

  async function createInvoice(dto) {
    return apiFetch("/billing/invoices", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  async function updateInvoice(id, dto) {
    return apiFetch(`/billing/invoices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  }

  async function deleteInvoice(id) {
    return apiFetch(`/billing/invoices/${id}`, {
      method: "DELETE",
    });
  }

  // ── PAYMENTS ────────────────────────────

  async function fetchPayments() {
    return apiFetch("/billing/payments");
  }

  async function fetchPaymentsByInvoice(id) {
    return apiFetch(`/billing/payments/invoice/${id}`);
  }

  async function recordPayment(invoiceId, paymentMethod) {
    return apiFetch(`/billing/payments/${invoiceId}`, {
      method: "POST",
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