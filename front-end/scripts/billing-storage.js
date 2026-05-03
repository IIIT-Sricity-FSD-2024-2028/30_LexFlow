(function () {
  const BILLING_REFERENCE_DATE = new Date();


  function toIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function normalizeDueDateTo2026(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "2026-12-31";
    }
    parsed.setFullYear(2026);
    return toIsoDate(parsed);
  }

  function deriveInvoiceStatus(status, dueDate) {
    const normalized = String(status || "").toLowerCase().trim();
    if (normalized === "paid" || normalized === "completed") {
      return "Paid";
    }

    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) {
      return "Pending";
    }

    return due < BILLING_REFERENCE_DATE ? "Overdue" : "Pending";
  }

  function normalizeInvoices(invoices) {
    if (!Array.isArray(invoices)) {
      return [];
    }
    return invoices.map((invoice) => ({
      ...invoice,
      amount: Number(invoice.amount) || 0,
      dueDate: normalizeDueDateTo2026(invoice.dueDate),
      status: deriveInvoiceStatus(invoice.status, normalizeDueDateTo2026(invoice.dueDate)),
    }));
  }

  function normalizePayments(payments) {
    if (!Array.isArray(payments)) {
      return [];
    }
    return payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount) || 0,
      status: payment.status || "Completed",
    }));
  }

  function syncLegacyBillingFromDedicated() {
    // No-op in in-memory mode
  }

  function saveBillingToAllStores(invoices, payments) {
    MEMORY_DB.invoices = normalizeInvoices(invoices);
    MEMORY_DB.payments = normalizePayments(payments);
    console.log('[BillingStorage] In-memory DB updated.');
  }

  function saveInvoicesToAllStores(invoices) {
    MEMORY_DB.invoices = normalizeInvoices(invoices);
    console.log('[BillingStorage] In-memory invoices updated.');
  }


  // In-memory data storage (Replaces removed JSON and restricted localStorage)
  const MEMORY_DB = {
    invoices: [
      { id: "INV-001", clientId: "user-2", amount: 5000, dueDate: "2026-05-15", status: "Paid", description: "Initial Consultation Fee" },
      { id: "INV-002", clientId: "user-2", amount: 12500, dueDate: "2026-06-20", status: "Pending", description: "Retainer Fee - Case #1" },
      { id: "INV-003", clientId: "user-2", amount: 8000, dueDate: "2026-04-10", status: "Overdue", description: "Legal Research Services" },
    ],
    payments: [
      { id: "PAY-001", invoiceId: "INV-001", amount: 5000, date: "2026-05-01", method: "UPI", status: "Completed" },
    ]
  };

  async function ensureBillingStorage() {
    console.log('[BillingStorage] Using in-memory storage.');
    
    return {
      invoices: normalizeInvoices(MEMORY_DB.invoices),
      payments: normalizePayments(MEMORY_DB.payments),
    };
  }


  window.LexFlowBillingStorage = {
    ensureBillingStorage,
    normalizeInvoices,
    normalizePayments,
    saveBillingToAllStores,
    saveInvoicesToAllStores,
  };
})();
