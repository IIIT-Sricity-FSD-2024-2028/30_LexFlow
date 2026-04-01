document.addEventListener("DOMContentLoaded", () => {
  let invoices = [];
  let payments = [];
  let currentFilter = "All";

  // ── Data Loading ───────────────────────────────────────
  fetch("../scripts/client_casemanagement_mock-data.json")
    .then((r) => r.json())
    .then((data) => {
      if (data.invoices) invoices = data.invoices;
      if (data.payments) payments = data.payments;
      updateSummaries();
      renderInvoices();
      renderPaymentHistory();
    })
    .catch((err) => console.error("Error loading billing data:", err));

  // ── Summaries ─────────────────────────────────────────
  function updateSummaries() {
    let totalBilled = 0, totalPaid = 0, pending = 0, overdue = 0;
    invoices.forEach((inv) => {
      totalBilled += inv.amount;
      if (inv.status === "Paid") totalPaid += inv.amount;
      else if (inv.status === "Pending") pending += inv.amount;
      else if (inv.status === "Overdue") overdue += inv.amount;
    });
    // Fall back to payments array for paid total if no paid invoices
    if (totalPaid === 0 && payments.length > 0) {
      payments.forEach((p) => (totalPaid += p.amount));
    }
    const fmt = (v) =>
      "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("valTotalBilled").textContent = fmt(totalBilled);
    document.getElementById("valTotalPaid").textContent   = fmt(totalPaid);
    document.getElementById("valPending").textContent     = fmt(pending);
    document.getElementById("valOverdue").textContent     = fmt(overdue);
  }

  // ── Helpers ───────────────────────────────────────────
  function formatDate(str) {
    return new Date(str).toLocaleDateString("en-US", {
      month: "short", day: "2-digit", year: "numeric",
    });
  }

  // ── Invoice Table ─────────────────────────────────────
  const searchInput = document.getElementById("searchInvoiceInput");
  const filterBtns  = document.querySelectorAll(".filter-btn");

  function renderInvoices() {
    const tbody = document.getElementById("invoicesList");
    const query = searchInput.value.toLowerCase().trim();
    tbody.innerHTML = "";

    const filtered = invoices.filter((inv) => {
      const matchFilter = currentFilter === "All" || inv.status === currentFilter;
      const matchSearch =
        inv.id.toLowerCase().includes(query) ||
        inv.caseName.toLowerCase().includes(query);
      return matchFilter && matchSearch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center; color:#6b7280;">No invoices found.</td></tr>';
      return;
    }

    const eyeIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
    const dlIcon  = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`;

    filtered.forEach((inv) => {
      const tr = document.createElement("tr");

      const badgeClass =
        inv.status === "Paid"    ? "badge-paid"    :
        inv.status === "Pending" ? "badge-pending" : "badge-overdue";

      const dueClass = (() => {
        if (inv.status === "Paid") return "due-green";
        const daysLeft = Math.ceil((new Date(inv.dueDate) - new Date()) / 864e5);
        return daysLeft < 0 ? "due-red" : daysLeft <= 14 ? "due-yellow" : "due-green";
      })();

      let actions = "";
      if (inv.status !== "Paid") {
        actions += `<button class="btn-pay-now" onclick="window.location.href='client_billing_pay-now.html?id=${encodeURIComponent(inv.id)}'">Pay Now</button>`;
      }
      actions += `<button class="icon-btn" title="View details" onclick="openInvoiceModal('${inv.id}')">${eyeIcon}</button>`;
      actions += `<button class="icon-btn" title="Download invoice" onclick="downloadInvoice('${inv.id}')">${dlIcon}</button>`;

      tr.innerHTML = `
        <td><a href="#" class="dt-id" onclick="openInvoiceModal('${inv.id}'); return false;">${inv.id}</a></td>
        <td><div style="font-weight:600;">${inv.caseName}</div></td>
        <td style="color:#6b7280;">${inv.lawyerName || "N/A"}</td>
        <td style="font-weight:700; color:#1a1a2e;">$${inv.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td><span class="badge-status ${badgeClass}">${inv.status}</span></td>
        <td class="${dueClass}" style="font-weight:600;">${formatDate(inv.dueDate)}</td>
        <td class="action-cell">${actions}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── Payment History ───────────────────────────────────
  function renderPaymentHistory() {
    const tbody = document.getElementById("paymentHistoryList");
    tbody.innerHTML = "";

    if (payments.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center; color:#6b7280;">No payment history.</td></tr>';
      return;
    }

    payments.slice(0, 3).forEach((pay) => {
      const tr = document.createElement("tr");
      const methodIcon = (pay.method || "").toLowerCase().includes("bank")
        ? `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>`
        : `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>`;

      tr.innerHTML = `
        <td style="font-weight:600; color:#1a1a2e;">${pay.id}</td>
        <td><a href="#" class="dt-id" onclick="openInvoiceModal('${pay.invoiceId}'); return false;">${pay.invoiceId}</a></td>
        <td style="font-weight:700; color:#1a1a2e;">$${(pay.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td style="color:#6b7280;">${formatDate(pay.date)}</td>
        <td><div class="pay-method">${methodIcon} ${pay.method}</div></td>
        <td><span class="badge-status badge-completed">${pay.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── Search & Filter ───────────────────────────────────
  searchInput.addEventListener("input", renderInvoices);

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.getAttribute("data-filter");
      renderInvoices();
    });
  });

  // ── Modal Functions ───────────────────────────────────
  window.openInvoiceModal = function (invoiceId) {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    const content = document.getElementById("modalContent");
    content.innerHTML = `
      <div class="invoice-detail-grid">
        <div class="detail-item">
          <label>Invoice ID</label>
          <div>${inv.id}</div>
        </div>
        <div class="detail-item">
          <label>Status</label>
          <div style="margin-top:4px;">
            <span class="badge-status badge-${inv.status.toLowerCase()}">${inv.status}</span>
          </div>
        </div>
        <div class="detail-item">
          <label>Case Name</label>
          <div>${inv.caseName}</div>
        </div>
        <div class="detail-item">
          <label>Advocate Name</label>
          <div>${inv.lawyerName || "N/A"}</div>
        </div>
        <div class="detail-item">
          <label>Amount Due</label>
          <div style="font-size:18px; color:#1a2340; font-weight:800;">
            $${inv.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div class="detail-item">
          <label>Due Date</label>
          <div>${formatDate(inv.dueDate)}</div>
        </div>
      </div>
      <div style="margin-top:24px; padding:16px; background:rgba(59,91,219,0.05); border-radius:12px; border:1px dashed rgba(59,91,219,0.2);">
        <div style="font-size:10px; color:#3b5bdb; font-weight:700; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">Notes</div>
        <p style="font-size:12px; color:#86868b; margin:0; line-height:1.5;">This is a system-generated invoice. For any discrepancies, please contact your advocate or the billing department.</p>
      </div>
    `;

    const printBtn = document.getElementById("printBtnView");
    if (printBtn) printBtn.onclick = () => downloadInvoice(inv.id);

    document.getElementById("invoiceModal").classList.add("active");
  };

  window.closeInvoiceModal = function () {
    document.getElementById("invoiceModal").classList.remove("active");
  };

  window.downloadInvoice = function (invoiceId) {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    document.getElementById("printClient").textContent = inv.lawyerName || "N/A";
    document.getElementById("printInvId").textContent  = inv.id;
    document.getElementById("printDate").textContent   = new Date().toLocaleDateString("en-US", {
      day: "2-digit", month: "short", year: "numeric",
    });
    document.getElementById("printCase").textContent   = inv.caseName;
    document.getElementById("printAmount").textContent =
      "$" + inv.amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
    document.getElementById("printTotal").textContent  =
      "$" + inv.amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
    document.getElementById("printDue").textContent    = formatDate(inv.dueDate);

    window.print();
  };

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("invoiceModal");
    if (e.target === modal) closeInvoiceModal();
  });
});
