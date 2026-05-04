let billingStorage;
let normalizeInvoices;
let normalizePayments;
let ensureBillingStorage;

const BILLING_TODAY = new Date();

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value) {
  return "₹" + value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

document.addEventListener("DOMContentLoaded", async () => {

  // initialize billing storage AFTER page load
  billingStorage = window.LexFlowBillingStorage;
  normalizeInvoices = billingStorage.normalizeInvoices;
  normalizePayments = billingStorage.normalizePayments;
  ensureBillingStorage = billingStorage.ensureBillingStorage;

  let invoices = [];
  let payments = [];
  let currentFilter = "All";

  const searchInput = document.getElementById("searchInvoiceInput");
  const filterButtons = document.querySelectorAll(".filter-btn");
  const invoicesList = document.getElementById("invoicesList");
  const paymentHistoryList = document.getElementById("paymentHistoryList");

  function renderSummaryCards() {
    let totalBilled = 0;
    let totalPaid = 0;
    let pendingAmount = 0;
    let overdueAmount = 0;

    invoices.forEach((invoice) => {
      totalBilled += invoice.amount;

      if (invoice.status === "Paid") {
        totalPaid += invoice.amount;
      } else if (invoice.status === "Pending") {
        pendingAmount += invoice.amount;
      } else if (invoice.status === "Overdue") {
        overdueAmount += invoice.amount;
      }
    });

    if (totalPaid === 0 && payments.length > 0) {
      payments.forEach((payment) => {
        totalPaid += payment.amount;
      });
    }

    document.getElementById("valTotalBilled").textContent = formatCurrency(totalBilled);
    document.getElementById("valTotalPaid").textContent = formatCurrency(totalPaid);
    document.getElementById("valPending").textContent = formatCurrency(pendingAmount);
    document.getElementById("valOverdue").textContent = formatCurrency(overdueAmount);
  }

  function renderInvoices() {
    const query = (searchInput.value || "").toLowerCase().trim();
    invoicesList.innerHTML = "";

    const filtered = invoices.filter((invoice) => {
      const matchesFilter = currentFilter === "All" || invoice.status === currentFilter;
      const matchesQuery =
        invoice.id.toLowerCase().includes(query) ||
        (invoice.caseName || "").toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    });

    if (filtered.length === 0) {
      invoicesList.innerHTML =
        '<tr><td colspan="7" style="text-align:center; color:#6b7280;">No invoices found.</td></tr>';
      return;
    }

    filtered.forEach((invoice) => {
      const row = document.createElement("tr");

      const badgeClass =
        invoice.status === "Paid"
          ? "badge-paid"
          : invoice.status === "Pending"
            ? "badge-pending"
            : "badge-overdue";

      const dueClass =
        invoice.status === "Paid"
          ? "due-green"
          : invoice.status === "Overdue"
            ? "due-red"
            : (() => {
              const days = Math.ceil(
                (new Date(invoice.dueDate) - BILLING_TODAY) / 86400000
              );
              if (days <= 14) {
                return "due-yellow";
              }
              return "due-green";
            })();

      let actionsHtml = "";
      if (invoice.status !== "Paid") {
        actionsHtml += `<button class="btn-pay-now" onclick="window.location.href='client_billing_pay-now.html?id=${encodeURIComponent(
          invoice.id
        )}'">Pay Now</button>`;
      }

      row.innerHTML = `
        <td><span class="dt-id">${invoice.id}</span></td>
        <td><div style="font-weight:600;">${invoice.caseName || "-"}</div></td>
        <td style="color:#6b7280;">${invoice.lawyerName || "Awaiting Assignment"}</td>
        <td style="font-weight:700; color:#1a1a2e;">${formatCurrency(invoice.amount)}</td>
        <td><span class="badge-status ${badgeClass}">${invoice.status}</span></td>
        <td class="${dueClass}" style="font-weight:600;">${formatDate(invoice.dueDate)}</td>
        <td class="action-cell">${actionsHtml}</td>
      `;

      invoicesList.appendChild(row);
    });
  }

  function renderPaymentHistory() {
    paymentHistoryList.innerHTML = "";

    if (payments.length === 0) {
      paymentHistoryList.innerHTML =
        '<tr><td colspan="6" style="text-align:center; color:#6b7280;">No payment history.</td></tr>';
      return;
    }

    payments.slice(0, 3).forEach((payment) => {
      const row = document.createElement("tr");

      const methodIcon = (payment.method || "")
        .toLowerCase()
        .includes("bank")
        ? '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>'
        : '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>';

      row.innerHTML = `
        <td style="font-weight:600; color:#1a1a2e;">${payment.id}</td>
        <td><span class="dt-id">${payment.invoiceId}</span></td>
        <td style="font-weight:700; color:#1a1a2e;">${formatCurrency(payment.amount)}</td>
        <td style="color:#6b7280;">${formatDate(payment.date)}</td>
        <td><div class="pay-method">${methodIcon} ${payment.method || "Card"}</div></td>
        <td><span class="badge-status badge-completed">${payment.status || "Completed"}</span></td>
      `;

      paymentHistoryList.appendChild(row);
    });
  }

  try {
    const data = await ensureBillingStorage();

    invoices = normalizeInvoices(data.invoices || []);
    payments = normalizePayments(data.payments || []);

    renderSummaryCards();
    renderInvoices();
    renderPaymentHistory();
  } catch (error) {
    console.error("Error loading billing data:", error);
  }

  searchInput.addEventListener("input", renderInvoices);

  filterButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      event.target.classList.add("active");

      currentFilter = event.target.getAttribute("data-filter");
      renderInvoices();
    });
  });
});