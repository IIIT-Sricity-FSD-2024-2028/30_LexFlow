/**
 * firm_lawyer_billing.js
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

document.addEventListener("DOMContentLoaded", async () => {

  const API_BASE = "/billing";

  async function fetchInvoices() {
    const res = await fetch(`${API_BASE}/invoices`, {
      headers: { role: "firmadmin" }
    });
    const json = await res.json();
    return json.data || [];
  }

  async function fetchPayments() {
    const res = await fetch(`${API_BASE}/payments`, {
      headers: { role: "firmadmin" }
    });
    const json = await res.json();
    return json.data || [];
  }

  async function fetchClients() {
    const res = await fetch(`${API_BASE}/clients`, {
      headers: { role: "firmadmin" }
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
        role: "firmadmin"
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
        role: "firmadmin"
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (!res.ok) throw new Error(json.message || "Update failed");

    return json.data;
  }

  let invoices = [];
  let payments = [];
  let currentFilter = "All";

  const invoicesList = document.getElementById("invoicesList");
  const paymentHistoryList = document.getElementById("paymentHistoryList");
  const searchInput = document.getElementById("searchInvoiceInput");
  const filterBtns = document.querySelectorAll(".filter-btn");

  function updateSummaries() {

    let totalRevenue = 0;
    let pendingAmount = 0;
    let paidCount = 0;
    let overdueCount = 0;

    invoices.forEach(inv => {

      if (inv.status === "Paid") {
        totalRevenue += inv.amount;
        paidCount++;
      }

      if (inv.status === "Pending") {
        pendingAmount += inv.amount;
      }

      if (inv.status === "Overdue") {
        pendingAmount += inv.amount;
        overdueCount++;
      }

    });

    document.getElementById("valTotalRevenue").textContent = formatCurrency(totalRevenue);
    document.getElementById("valPending").textContent = formatCurrency(pendingAmount);
    document.getElementById("valPaidInvoices").textContent = paidCount;
    document.getElementById("valOverdueInvoices").textContent = overdueCount;

  }

  // ───────── CLIENT DROPDOWN ─────────

  window.openCreateModal = async function () {

    document.getElementById("createInvoiceModal").classList.add("active");
    document.getElementById("createInvoiceForm").reset();

    const select = document.getElementById("createInvClient");

    select.innerHTML = `<option disabled selected>Loading clients...</option>`;

    try {

      const clients = await fetchClients();

      if (!clients.length) {
        select.innerHTML = `<option disabled>No clients found</option>`;
        return;
      }

      select.innerHTML = `<option disabled selected>Select client</option>`;

      clients.forEach(c => {

        const opt = document.createElement("option");

        opt.value = c.id;
        opt.textContent = `${c.fullName} — ${c.email}`;

        opt.dataset.email = c.email;
        opt.dataset.name = c.fullName;

        select.appendChild(opt);

      });

    } catch (err) {

      console.error("fetchClients error", err);

      select.innerHTML =
        `<option disabled>⚠ Failed to load clients</option>`;

    }

    select.onchange = () => {

      const chosen = select.options[select.selectedIndex];

      document.getElementById("createInvClientId").value = chosen.value;
      document.getElementById("createInvClientEmail").value =
        chosen.dataset.email || "";

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

    if (!clientId) return alert("Select client");
    if (!caseName) return alert("Enter case name");
    if (!amount || amount <= 0) return alert("Invalid amount");
    if (!dueDate) return alert("Select due date");

    try {

      const created = await createInvoice({
        clientId,
        caseName,
        amount,
        status,
        dueDate
      });

      invoices.unshift(created);

      updateSummaries();
      renderInvoices();

      closeCreateModal();

    } catch (err) {

      alert("Failed: " + err.message);

    }

  };

  // ───────── RENDER INVOICES ─────────

  function renderInvoices() {

    if (!invoicesList) return;

    const query = (searchInput?.value || "").toLowerCase();

    invoicesList.innerHTML = "";

    const filtered = invoices.filter(inv => {

      const filterMatch =
        currentFilter === "All" || inv.status === currentFilter;

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
        <td>${inv.id}</td>
        <td>${inv.clientName || "-"}</td>
        <td>${inv.caseName}</td>
        <td>${formatCurrency(inv.amount)}</td>
        <td>${inv.status}</td>
        <td>${inv.dueDate}</td>
        <td>-</td>
      `;

      invoicesList.appendChild(tr);

    });

  }

  function renderPaymentHistory() {

    if (!paymentHistoryList) return;

    paymentHistoryList.innerHTML = "";

    if (!payments.length) {

      paymentHistoryList.innerHTML =
        `<tr><td colspan="7">No payment history</td></tr>`;

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
        <td>Completed</td>
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

    const [inv, pay] = await Promise.all([
      fetchInvoices(),
      fetchPayments()
    ]);

    invoices = inv;
    payments = pay;

    updateSummaries();
    renderInvoices();
    renderPaymentHistory();

  } catch (err) {

    console.error("Billing load error", err);

  }

});