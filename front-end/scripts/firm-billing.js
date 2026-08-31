/**
 * firm-billing.js
 * LAWYER / FIRMADMIN billing dashboard
 */

const formatCurrency = (val) =>
  "₹" + Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function showSkeleton(tbodyId, cols) {
  const el = document.getElementById(tbodyId);
  if (!el) return;
  el.innerHTML = Array.from({ length: 4 }, () =>
    `<tr>${Array.from({ length: cols }, () =>
      `<td><div style="height:14px;border-radius:4px;
      background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);
      background-size:200% 100%;animation:shimmer 1.5s ease-in-out infinite;"></div></td>`
    ).join("")}</tr>`
  ).join("");
}

function statusBadge(status) {
  const map = {
    "Paid": "badge-paid",
    "Pending": "badge-pending",
    "Overdue": "badge-overdue",
  };
  const cls = map[status] || "badge-pending";
  return `<span class="badge-status ${cls}">${status}</span>`;
}

document.addEventListener("DOMContentLoaded", async () => {

  const API_BASE = window.LexFlowAPI.BASE_URL + '/billing';

  function getCallerId() {
    try {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      return (user && user.id) ? user.id : "";
    } catch {
      return "";
    }
  }

  async function fetchInvoices() {
    const res = await fetch(`${API_BASE}/invoices`, {
      headers: { role: "firmadmin", "x-user-id": getCallerId() }
    });
    const json = await res.json();
    return json.data || [];
  }

  async function fetchPayments() {
    const res = await fetch(`${API_BASE}/payments`, {
      headers: { role: "firmadmin", "x-user-id": getCallerId() }
    });
    const json = await res.json();
    return json.data || [];
  }

  async function fetchClients() {
    const res = await fetch(`${API_BASE}/clients`, {
      headers: { role: "firmadmin", "x-user-id": getCallerId() }
    });
    if (!res.ok) throw new Error("Failed to fetch clients");
    const json = await res.json();
    return json.data || [];
  }

  async function createInvoice(payload) {
    const res = await fetch(`${API_BASE}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        role: "firmadmin",
        "x-user-id": getCallerId()
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Create invoice failed");
    return json.data;
  }

  async function updateInvoice(id, payload) {
    const res = await fetch(`${API_BASE}/invoices/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        role: "firmadmin",
        "x-user-id": getCallerId()
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Update failed");
    return json.data;
  }

  async function deleteInvoice(id) {
    const res = await fetch(`${API_BASE}/invoices/${id}`, {
      method: "DELETE",
      headers: { role: "firmadmin", "x-user-id": getCallerId() }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Delete failed");
    return json;
  }

  let invoices = [];
  let payments = [];
  let currentFilter = "All";

  const invoicesList = document.getElementById("invoicesList");
  const paymentHistoryList = document.getElementById("paymentHistoryList");
  const searchInput = document.getElementById("searchInvoiceInput");
  const filterBtns = document.querySelectorAll(".filter-btn");

  function updateSummaries() {
    let pendingAmount = 0, totalBilled = 0, overdueCount = 0;
    
    // 1. Invoices aggregations
    invoices.forEach(inv => {
      totalBilled += inv.amount;
      if (inv.status === "Pending") { pendingAmount += inv.amount; }
      if (inv.status === "Overdue") { pendingAmount += inv.amount; overdueCount++; }
    });

    // 2. Payments aggregations (Total Amount Paid)
    let totalPaid = 0;
    payments.forEach(p => {
      totalPaid += p.amount;
    });

    document.getElementById("valTotalRevenue").textContent = formatCurrency(totalPaid);
    document.getElementById("valPending").textContent = formatCurrency(pendingAmount);
    document.getElementById("valTotalBilled").textContent = formatCurrency(totalBilled);
    document.getElementById("valOverdueInvoices").textContent = overdueCount;
  }

  // ───────── POPULATE CLIENT SELECT HELPER ─────────
  async function populateClientSelect(selectId, selectedClientId = null) {
    const select = document.getElementById(selectId);
    select.innerHTML = `<option disabled selected>Loading clients...</option>`;
    try {
      const clients = await fetchClients();
      if (!clients.length) {
        select.innerHTML = `<option disabled>No clients found</option>`;
        return;
      }
      select.innerHTML = `<option disabled ${!selectedClientId ? "selected" : ""}>Select client</option>`;
      clients.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.fullName} — ${c.email}`;
        opt.dataset.email = c.email;
        opt.dataset.name = c.fullName;
        if (c.id === selectedClientId) opt.selected = true;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error("fetchClients error", err);
      select.innerHTML = `<option disabled>⚠ Failed to load clients</option>`;
    }
  }

  // ───────── CREATE MODAL ─────────
  window.openCreateModal = async function () {
    document.getElementById("createInvoiceModal").classList.add("active");
    document.getElementById("createInvoiceForm").reset();
    document.getElementById("createInvClientId").value = "";
    document.getElementById("createInvClientEmail").value = "";

    await populateClientSelect("createInvClient");

    const select = document.getElementById("createInvClient");
    select.onchange = () => {
      const chosen = select.options[select.selectedIndex];
      document.getElementById("createInvClientId").value = chosen.value;
      document.getElementById("createInvClientEmail").value = chosen.dataset.email || "";
    };
  };

  window.closeCreateModal = () =>
    document.getElementById("createInvoiceModal").classList.remove("active");

  // ───────── CREATE INVOICE ─────────
  window.createNewInvoice = async function () {
    const clientId = document.getElementById("createInvClientId").value.trim();
    const caseName = document.getElementById("createInvCase").value.trim();
    const amount = parseFloat(document.getElementById("createInvAmount").value);
    const status = document.getElementById("createInvStatus").value;
    const dueDate = document.getElementById("createInvDueDate").value;

    if (!clientId) return alert("Select a client");
    if (!caseName) return alert("Enter case name");
    if (!amount || amount <= 0) return alert("Invalid amount");
    if (!dueDate) return alert("Select due date");

    try {
      const created = await createInvoice({ clientId, caseName, amount, status, dueDate });
      invoices.unshift(created);
      updateSummaries();
      renderInvoices();
      window.closeCreateModal();
    } catch (err) {
      alert("Failed: " + err.message);
    }
  };

  // ───────── EDIT MODAL ─────────
  window.openEditModal = async function (id) {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;

    document.getElementById("editInvoiceModal").classList.add("active");
    document.getElementById("editInvId").value = inv.id;
    document.getElementById("editInvCase").value = inv.caseName;
    document.getElementById("editInvAmount").value = inv.amount;
    document.getElementById("editInvStatus").value = inv.status;
    document.getElementById("editInvDueDate").value = inv.dueDate;

    await populateClientSelect("editInvClient", inv.clientId);

    const select = document.getElementById("editInvClient");
    select.onchange = () => {
      const chosen = select.options[select.selectedIndex];
      // store chosen value back on the hidden field reusing editInvId scope
      select.dataset.selectedId = chosen.value;
    };
  };

  window.closeEditModal = () =>
    document.getElementById("editInvoiceModal").classList.remove("active");

  window.saveInvoiceChanges = async function () {
    const id = document.getElementById("editInvId").value;
    const select = document.getElementById("editInvClient");
    const clientId = select.dataset.selectedId || select.value;
    const caseName = document.getElementById("editInvCase").value.trim();
    const amount = parseFloat(document.getElementById("editInvAmount").value);
    const status = document.getElementById("editInvStatus").value;
    const dueDate = document.getElementById("editInvDueDate").value;

    if (!caseName) return alert("Enter case name");
    if (!amount || amount <= 0) return alert("Invalid amount");
    if (!dueDate) return alert("Select due date");

    try {
      const updated = await updateInvoice(id, { clientId, caseName, amount, status, dueDate });
      const idx = invoices.findIndex(i => i.id === id);
      if (idx !== -1) invoices[idx] = updated;
      updateSummaries();
      renderInvoices();
      window.closeEditModal();
    } catch (err) {
      alert("Failed: " + err.message);
    }
  };

  // ───────── VIEW MODAL ─────────
  window.openInvoiceModal = function (id) {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;

    document.getElementById("modalContent").innerHTML = `
      <div class="invoice-detail-grid">
        <div class="detail-item"><label>Invoice ID</label><div>${inv.id}</div></div>
        <div class="detail-item"><label>Status</label><div>${statusBadge(inv.status)}</div></div>
        <div class="detail-item"><label>Client</label><div>${inv.clientName || "-"}</div></div>
        <div class="detail-item"><label>Email</label><div>${inv.clientEmail || "-"}</div></div>
        <div class="detail-item"><label>Case</label><div>${inv.caseName}</div></div>
        <div class="detail-item"><label>Advocate</label><div>${inv.advocateName || "-"}</div></div>
        <div class="detail-item"><label>Amount</label><div>${formatCurrency(inv.amount)}</div></div>
        <div class="detail-item"><label>Due Date</label><div>${inv.dueDate}</div></div>
        <div class="detail-item"><label>Created At</label><div>${new Date(inv.createdAt).toLocaleDateString("en-IN")}</div></div>
      </div>
    `;

    // wire up PDF print button
    document.getElementById("printBtnView").onclick = () => printInvoice(inv);

    document.getElementById("invoiceModal").classList.add("active");
  };

  window.closeInvoiceModal = () =>
    document.getElementById("invoiceModal").classList.remove("active");

  // ───────── DELETE ─────────
  window.confirmDeleteInvoice = async function (id) {
    if (!confirm(`Delete invoice ${id}? This cannot be undone.`)) return;
    try {
      await deleteInvoice(id);
      invoices = invoices.filter(i => i.id !== id);
      updateSummaries();
      renderInvoices();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // ───────── PRINT / PDF ─────────
  function printInvoice(inv) {
    document.getElementById("printClient").textContent = inv.clientName || "-";
    document.getElementById("printInvId").textContent = inv.id;
    document.getElementById("printDate").textContent = new Date(inv.createdAt).toLocaleDateString("en-IN");
    document.getElementById("printCase").textContent = inv.caseName;
    document.getElementById("printAmount").textContent = formatCurrency(inv.amount);
    document.getElementById("printTotal").textContent = formatCurrency(inv.amount);
    document.getElementById("printDue").textContent = inv.dueDate;
    document.getElementById("printableInvoice").style.display = "block";
    window.print();
    document.getElementById("printableInvoice").style.display = "none";
  }

  // ───────── RENDER INVOICES ─────────
  function renderInvoices() {
    if (!invoicesList) return;

    const query = (searchInput?.value || "").toLowerCase();
    invoicesList.innerHTML = "";

    const filtered = invoices.filter(inv => {
      const filterMatch = currentFilter === "All" || inv.status === currentFilter;
      const searchMatch =
        inv.id.toLowerCase().includes(query) ||
        inv.caseName.toLowerCase().includes(query) ||
        (inv.clientName || "").toLowerCase().includes(query);
      return filterMatch && searchMatch;
    });

    if (!filtered.length) {
      invoicesList.innerHTML =
        `<tr><td colspan="7" style="text-align:center">No invoices</td></tr>`;
      return;
    }

    filtered.forEach(inv => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="dt-id" style="cursor:pointer" onclick="openInvoiceModal('${inv.id}')">${inv.id}</span></td>
        <td>${inv.clientName || "-"}</td>
        <td>${inv.caseName}</td>
        <td>${formatCurrency(inv.amount)}</td>
        <td>${statusBadge(inv.status)}</td>
        <td>${inv.dueDate}</td>
        <td>
          <div class="action-cell">
            <button class="icon-btn" title="View" onclick="openInvoiceModal('${inv.id}')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7
                     -1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
            <button class="icon-btn icon-btn-edit" title="Edit" onclick="openEditModal('${inv.id}')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                     m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button class="icon-btn icon-btn-delete" title="Delete" onclick="confirmDeleteInvoice('${inv.id}')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7
                     m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </td>
      `;
      invoicesList.appendChild(tr);
    });
  }

  // ───────── RENDER PAYMENTS ─────────
  function renderPaymentHistory() {
    if (!paymentHistoryList) return;
    paymentHistoryList.innerHTML = "";

    if (!payments.length) {
      paymentHistoryList.innerHTML =
        `<tr><td colspan="7" style="text-align:center">No payment history</td></tr>`;
      return;
    }

    payments.forEach(p => {
      const tr = document.createElement("tr");
      const date = p.paymentDate
        ? new Date(p.paymentDate).toLocaleDateString("en-IN")
        : "-";
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.invoiceId}</td>
        <td>${p.clientName || "-"}</td>
        <td>${formatCurrency(p.amount)}</td>
        <td>${date}</td>
        <td>${p.paymentMethod || "-"}</td>
        <td><span class="badge-status badge-completed">Completed</span></td>
      `;
      paymentHistoryList.appendChild(tr);
    });
  }

  if (searchInput)
    searchInput.addEventListener("input", renderInvoices);

  filterBtns.forEach(btn => {
    btn.addEventListener("click", e => {
      filterBtns.forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.getAttribute("data-filter");
      renderInvoices();
    });
  });

  showSkeleton("invoicesList", 7);
  showSkeleton("paymentHistoryList", 7);

  try {
    const [inv, pay] = await Promise.all([fetchInvoices(), fetchPayments()]);
    invoices = inv;
    payments = pay;
    updateSummaries();
    renderInvoices();
    renderPaymentHistory();
  } catch (err) {
    console.error("Billing load error", err);
  }

});