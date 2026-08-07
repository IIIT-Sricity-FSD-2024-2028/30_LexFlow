const BILLING_TODAY = new Date();

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value) {
  return "₹" + Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

document.addEventListener("DOMContentLoaded", async () => {

  // Set role so billing-storage.js sends correct header
  window.LEXFLOW_ROLE = "client";

  const api = window.LexFlowBillingStorage;

  let invoices = [];
  let payments = [];
  let currentFilter = "All";

  const searchInput = document.getElementById("searchInvoiceInput");
  const filterButtons = document.querySelectorAll(".filter-btn");
  const invoicesList = document.getElementById("invoicesList");
  const paymentHistoryList = document.getElementById("paymentHistoryList");

  // ───────── SUMMARY CARDS ─────────
  function renderSummaryCards() {
    let totalBilled = 0, totalPaid = 0, pendingAmount = 0, overdueAmount = 0;

    invoices.forEach((inv) => {
      totalBilled += inv.amount;
      if (inv.status === "Paid") totalPaid += inv.amount;
      if (inv.status === "Pending") pendingAmount += inv.amount;
      if (inv.status === "Overdue") overdueAmount += inv.amount;
    });

    document.getElementById("valTotalBilled").textContent = formatCurrency(totalBilled);
    document.getElementById("valTotalPaid").textContent = formatCurrency(totalPaid);
    document.getElementById("valPending").textContent = formatCurrency(pendingAmount);
    document.getElementById("valOverdue").textContent = formatCurrency(overdueAmount);
  }

  // ───────── INVOICES TABLE ─────────
  function renderInvoices() {
    const query = (searchInput.value || "").toLowerCase().trim();
    invoicesList.innerHTML = "";

    const filtered = invoices.filter((inv) => {
      const matchesFilter = currentFilter === "All" || inv.status === currentFilter;
      const matchesQuery =
        inv.id.toLowerCase().includes(query) ||
        (inv.caseName || "").toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    });

    if (!filtered.length) {
      invoicesList.innerHTML =
        '<tr><td colspan="7" style="text-align:center; color:#6b7280;">No invoices found.</td></tr>';
      return;
    }

    filtered.forEach((inv) => {
      const row = document.createElement("tr");

      const badgeClass =
        inv.status === "Paid" ? "badge-paid" :
          inv.status === "Pending" ? "badge-pending" : "badge-overdue";

      const dueClass = inv.status === "Paid" ? "due-green" :
        inv.status === "Overdue" ? "due-red" : (() => {
          const days = Math.ceil((new Date(inv.dueDate) - BILLING_TODAY) / 86400000);
          return days <= 14 ? "due-yellow" : "due-green";
        })();

      const actionsHtml = inv.status !== "Paid"
        ? `<button class="btn-pay-now" onclick="window.location.href='client-billing-pay-now.html?id=${encodeURIComponent(inv.id)}'">Pay Now</button>`
        : "";

      row.innerHTML = `
        <td><span class="dt-id">${inv.id}</span></td>
        <td><div style="font-weight:600;">${inv.caseName || "-"}</div></td>
        <td style="color:#6b7280;">${inv.advocateName || "Awaiting Assignment"}</td>
        <td style="font-weight:700; color:#1a1a2e;">${formatCurrency(inv.amount)}</td>
        <td><span class="badge-status ${badgeClass}">${inv.status}</span></td>
        <td class="${dueClass}" style="font-weight:600;">${formatDate(inv.dueDate)}</td>
        <td class="action-cell">${actionsHtml}</td>
      `;

      invoicesList.appendChild(row);
    });
  }

  // ───────── PAYMENT HISTORY ─────────
  function renderPaymentHistory() {
    paymentHistoryList.innerHTML = "";

    if (!payments.length) {
      paymentHistoryList.innerHTML =
        '<tr><td colspan="6" style="text-align:center; color:#6b7280;">No payment history.</td></tr>';
      return;
    }

    payments.slice(0, 3).forEach((p) => {
      const row = document.createElement("tr");

      const methodIcon = (p.paymentMethod || "").toLowerCase().includes("bank")
        ? '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>'
        : '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>';

      row.innerHTML = `
        <td style="font-weight:600; color:#1a1a2e;">${p.id}</td>
        <td><span class="dt-id">${p.invoiceId}</span></td>
        <td style="font-weight:700; color:#1a1a2e;">${formatCurrency(p.amount)}</td>
        <td style="color:#6b7280;">${formatDate(p.paymentDate || p.date)}</td>
        <td><div class="pay-method">${methodIcon} ${p.paymentMethod || p.method || "Card"}</div></td>
        <td><span class="badge-status badge-completed">${p.status || "Completed"}</span></td>
      `;

      paymentHistoryList.appendChild(row);
    });
  }

  // ───────── LOAD DATA ─────────
  try {
    const [inv, pay] = await Promise.all([
      api.fetchInvoices(),
      api.fetchPayments(),
    ]);

    invoices = Array.isArray(inv) ? inv : [];
    payments = Array.isArray(pay) ? pay : [];

    renderSummaryCards();
    renderInvoices();
    renderPaymentHistory();
  } catch (err) {
    console.error("Error loading billing data:", err);
    invoicesList.innerHTML =
      '<tr><td colspan="7" style="text-align:center; color:#ef4444;">Failed to load invoices.</td></tr>';
  }

  // ───────── SEARCH & FILTER ─────────
  searchInput.addEventListener("input", renderInvoices);

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.getAttribute("data-filter");
      renderInvoices();
    });
  });

});