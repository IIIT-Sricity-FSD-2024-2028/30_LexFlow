/**
 * firm_lawyer_billing.js  —  LAWYER / FIRM_MANAGER view
 * Key changes vs previous version:
 *  - openCreateModal() now fetches /billing/clients and populates the <select>
 *  - createNewInvoice() reads clientId from dropdown, sends to POST /billing/invoices
 *  - editInvoice() shows clientName as read-only (client cannot be re-assigned)
 *  - All dates use <input type="date"> — no more free-text date parsing issues
 */


// ── Formatters ────────────────────────────────────────────────────────────────
const formatCurrency = (val) =>
  '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 });

// ── Skeleton helper ───────────────────────────────────────────────────────────
function showSkeleton(tbodyId, cols) {
  const el = document.getElementById(tbodyId);
  if (!el) return;
  el.innerHTML = Array.from({ length: 4 }, () =>
    `<tr>${Array.from({ length: cols }, () =>
      `<td><div style="height:14px;border-radius:4px;
        background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);
        background-size:200% 100%;animation:shimmer 1.5s ease-in-out infinite;"></div></td>`
    ).join('')}</tr>`
  ).join('');
}

// ── DOMContentLoaded ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  const {
    fetchInvoices,
    fetchSummary,
    fetchPayments,
    fetchClients,
    createInvoice,
    updateInvoice,
  } = window.LexFlowBillingStorage;

  let invoices = [];
  let payments = [];
  let currentFilter = 'All';

  const invoicesList = document.getElementById('invoicesList');
  const paymentHistoryList = document.getElementById('paymentHistoryList');
  const searchInput = document.getElementById('searchInvoiceInput');
  const filterBtns = document.querySelectorAll('.filter-btn');

  // ── Summary cards ─────────────────────────────────────────────────────────
  function updateSummaries() {
    let totalRevenue = 0, pendingAmount = 0, paidCount = 0, overdueCount = 0;
    invoices.forEach(inv => {
      if (inv.status === 'Paid') { totalRevenue += inv.amount; paidCount++; }
      else if (inv.status === 'Pending') { pendingAmount += inv.amount; }
      else if (inv.status === 'Overdue') { pendingAmount += inv.amount; overdueCount++; }
    });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('valTotalRevenue', formatCurrency(totalRevenue));
    set('valPending', formatCurrency(pendingAmount));
    set('valPaidInvoices', paidCount.toString());
    set('valOverdueInvoices', overdueCount.toString());
  }

  // ── View modal ────────────────────────────────────────────────────────────
  window.openInvoiceModal = function (invoiceId) {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    document.getElementById('modalContent').innerHTML = `
      <div class="invoice-detail-grid">
        <div class="detail-item"><label>Invoice ID</label><div>${inv.id}</div></div>
        <div class="detail-item"><label>Status</label>
          <div style="margin-top:4px;"><span class="badge-status badge-${inv.status.toLowerCase()}">${inv.status}</span></div>
        </div>
        <div class="detail-item"><label>Client</label><div>${inv.clientName || 'N/A'}</div></div>
        <div class="detail-item"><label>Client Email</label><div>${inv.clientEmail || 'N/A'}</div></div>
        <div class="detail-item"><label>Case Name</label><div>${inv.caseName}</div></div>
        <div class="detail-item"><label>Amount Due</label>
          <div style="font-size:18px;color:var(--clr-primary-dark);font-weight:800;">
            ₹${inv.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div class="detail-item"><label>Due Date</label><div>${inv.dueDate}</div></div>
      </div>
      <div style="margin-top:24px;padding:16px;background:rgba(59,91,219,0.05);
          border-radius:12px;border:1px dashed rgba(59,91,219,0.2);">
        <div style="font-size:10px;color:var(--clr-primary);font-weight:700;margin-bottom:8px;
            text-transform:uppercase;letter-spacing:0.05em;">Notes</div>
        <p style="font-size:12px;color:var(--clr-text-secondary);margin:0;line-height:1.5;">
          System generated invoice. For discrepancies contact the billing department.
        </p>
      </div>`;
    const printBtn = document.getElementById('printBtnView');
    if (printBtn) printBtn.onclick = () => window.downloadInvoice(inv.id);
    document.getElementById('invoiceModal').classList.add('active');
  };
  window.closeInvoiceModal = () => document.getElementById('invoiceModal').classList.remove('active');

  // ── Create modal — populate dropdown on open ──────────────────────────────
  window.openCreateModal = async function () {
    document.getElementById('createInvoiceForm').reset();
    document.getElementById('createInvoiceModal').classList.add('active');

    const select = document.getElementById('createInvClient');
    select.innerHTML = '<option value="" disabled selected>Loading clients…</option>';
    document.getElementById('createInvClientId').value = '';
    document.getElementById('createInvClientEmail').value = '';

    try {
      const clients = await fetchClients();
      if (!clients.length) {
        select.innerHTML = '<option value="" disabled>No clients registered yet</option>';
        return;
      }
      select.innerHTML = '<option value="" disabled selected>Select a client…</option>';
      clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.fullName}  —  ${c.email}`;
        opt.dataset.email = c.email;
        opt.dataset.name = c.fullName;
        select.appendChild(opt);
      });
    } catch (err) {
      select.innerHTML = '<option value="" disabled>⚠ Could not load clients</option>';
      console.error('fetchClients error:', err);
    }

    // Sync hidden fields when user picks a client
    select.onchange = () => {
      const chosen = select.options[select.selectedIndex];
      document.getElementById('createInvClientId').value = chosen.value;
      document.getElementById('createInvClientEmail').value = chosen.dataset.email || '';
    };
  };
  window.closeCreateModal = () => document.getElementById('createInvoiceModal').classList.remove('active');

  // ── Create invoice — send clientId to backend ────────────────────────────
  window.createNewInvoice = async function () {
    const clientId = document.getElementById('createInvClientId').value.trim();
    const caseName = document.getElementById('createInvCase').value.trim();
    const amount = parseFloat(document.getElementById('createInvAmount').value);
    const status = document.getElementById('createInvStatus').value;
    const dueDate = document.getElementById('createInvDueDate').value; // ISO from <input type="date">

    if (!clientId) { alert('Please select a client.'); return; }
    if (!caseName) { alert('Please enter a case name.'); return; }
    if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount.'); return; }
    if (!dueDate) { alert('Please select a due date.'); return; }

    try {
      const created = await createInvoice({ clientId, caseName, amount, status, dueDate });
      invoices.unshift(created);
      updateSummaries();
      renderInvoices();
      closeCreateModal();
    } catch (err) {
      alert('Failed to create invoice: ' + err.message);
    }
  };

  // ── Edit modal ────────────────────────────────────────────────────────────
  window.editInvoice = function (invoiceId) {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    document.getElementById('editInvId').value = inv.id;
    document.getElementById('editInvClient').value = `${inv.clientName || 'N/A'} — ${inv.clientEmail || ''}`;
    document.getElementById('editInvCase').value = inv.caseName || '';
    document.getElementById('editInvAmount').value = inv.amount;
    document.getElementById('editInvStatus').value = inv.status;
    document.getElementById('editInvDueDate').value = inv.dueDate || '';
    document.getElementById('editInvoiceModal').classList.add('active');
  };
  window.closeEditModal = () => document.getElementById('editInvoiceModal').classList.remove('active');

  window.saveInvoiceChanges = async function () {
    const id = document.getElementById('editInvId').value;
    const dueDate = document.getElementById('editInvDueDate').value; // ISO from <input type="date">
    const payload = {
      caseName: document.getElementById('editInvCase').value.trim(),
      amount: parseFloat(document.getElementById('editInvAmount').value),
      status: document.getElementById('editInvStatus').value,
      dueDate,
    };
    try {
      const updated = await updateInvoice(id, payload);
      const idx = invoices.findIndex(i => i.id === id);
      if (idx !== -1) invoices[idx] = updated;
      updateSummaries();
      renderInvoices();
      closeEditModal();
    } catch (err) {
      alert('Failed to save changes: ' + err.message);
    }
  };

  // ── Download / Print ──────────────────────────────────────────────────────
  window.downloadInvoice = function (invoiceId) {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    document.getElementById('printClient').textContent = inv.clientName || 'N/A';
    document.getElementById('printInvId').textContent = inv.id;
    document.getElementById('printDate').textContent =
      new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    document.getElementById('printCase').textContent = inv.caseName;
    document.getElementById('printAmount').textContent = formatCurrency(inv.amount);
    document.getElementById('printTotal').textContent = formatCurrency(inv.amount);
    document.getElementById('printDue').textContent = inv.dueDate;
    window.print();
  };

  // ── Backdrop click ────────────────────────────────────────────────────────
  window.onclick = function (event) {
    if (event.target === document.getElementById('invoiceModal')) closeInvoiceModal();
    if (event.target === document.getElementById('editInvoiceModal')) closeEditModal();
    if (event.target === document.getElementById('createInvoiceModal')) closeCreateModal();
  };

  // ── Render invoices table ─────────────────────────────────────────────────
  function renderInvoices() {
    if (!invoicesList) return;
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    invoicesList.innerHTML = '';

    const filtered = invoices.filter(inv => {
      const matchFilter = currentFilter === 'All' || inv.status === currentFilter;
      const matchSearch =
        inv.id.toLowerCase().includes(query) ||
        (inv.clientName && inv.clientName.toLowerCase().includes(query)) ||
        (inv.clientEmail && inv.clientEmail.toLowerCase().includes(query)) ||
        inv.caseName.toLowerCase().includes(query);
      return matchFilter && matchSearch;
    });

    if (!filtered.length) {
      invoicesList.innerHTML =
        '<tr><td colspan="7" style="text-align:center;color:var(--clr-text-tertiary);padding:40px;">No invoices found.</td></tr>';
      return;
    }

    const eyeIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
    const pencilIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>`;
    const downloadIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`;

    filtered.forEach(inv => {
      const tr = document.createElement('tr');
      let badgeClass = 'badge-paid';
      if (inv.status === 'Pending') badgeClass = 'badge-pending';
      if (inv.status === 'Overdue') badgeClass = 'badge-overdue';

      tr.innerHTML = `
        <td><a href="#" class="dt-id" onclick="openInvoiceModal('${inv.id}');return false;">${inv.id}</a></td>
        <td style="color:var(--clr-text);font-weight:600;">
          <div>${inv.clientName || 'N/A'}</div>
          <div style="font-size:11px;color:var(--clr-text-secondary);margin-top:2px;">${inv.clientEmail || ''}</div>
        </td>
        <td style="color:var(--clr-text-secondary);">${inv.caseName}</td>
        <td style="font-weight:700;color:var(--clr-text);">${formatCurrency(inv.amount)}</td>
        <td><span class="badge-status ${badgeClass}">${inv.status}</span></td>
        <td style="color:var(--clr-text-secondary);">${inv.dueDate}</td>
        <td class="action-cell">
          <button class="icon-btn" title="View"     onclick="openInvoiceModal('${inv.id}')">${eyeIcon}</button>
          <button class="icon-btn icon-btn-edit" title="Edit" onclick="editInvoice('${inv.id}')">${pencilIcon}</button>
          <button class="icon-btn" title="Download" onclick="downloadInvoice('${inv.id}')">${downloadIcon}</button>
        </td>`;
      invoicesList.appendChild(tr);
    });
  }

  // ── Render payments table ─────────────────────────────────────────────────
  function renderPaymentHistory() {
    if (!paymentHistoryList) return;
    paymentHistoryList.innerHTML = '';
    if (!payments.length) {
      paymentHistoryList.innerHTML =
        '<tr><td colspan="7" style="text-align:center;color:var(--clr-text-tertiary);padding:20px;">No payment history found.</td></tr>';
      return;
    }
    payments.forEach(pay => {
      const tr = document.createElement('tr');
      const dateStr = pay.paymentDate
        ? new Date(pay.paymentDate).toLocaleDateString('en-IN') : '-';
      tr.innerHTML = `
        <td style="font-weight:600;color:var(--clr-text);">${pay.id}</td>
        <td><a href="#" class="dt-id" onclick="openInvoiceModal('${pay.invoiceId}');return false;">${pay.invoiceId}</a></td>
        <td style="color:var(--clr-text);font-weight:600;">${pay.clientName || 'N/A'}</td>
        <td style="font-weight:700;color:var(--clr-text);">${formatCurrency(pay.amount)}</td>
        <td style="color:var(--clr-text-secondary);">${dateStr}</td>
        <td style="color:var(--clr-text-secondary);font-weight:500;">${pay.paymentMethod || '-'}</td>
        <td><span class="badge-status badge-completed">COMPLETED</span></td>`;
      paymentHistoryList.appendChild(tr);
    });
  }

  // ── Listeners ─────────────────────────────────────────────────────────────
  if (searchInput) searchInput.addEventListener('input', renderInvoices);
  filterBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-filter');
      renderInvoices();
    });
  });

  // ── Initial load ──────────────────────────────────────────────────────────
  showSkeleton('invoicesList', 7);
  showSkeleton('paymentHistoryList', 7);

  try {
    const [inv, pay] = await Promise.all([fetchInvoices(), fetchPayments()]);
    invoices = inv;
    payments = pay;
    updateSummaries();
    renderInvoices();
    renderPaymentHistory();
  } catch (err) {
    console.error('Billing load error:', err);
    const errRow = (cols, msg) =>
      `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:#ef4444;">⚠ ${msg}</td></tr>`;
    if (invoicesList) invoicesList.innerHTML = errRow(7, 'Could not load invoices. Is the backend running?');
    if (paymentHistoryList) paymentHistoryList.innerHTML = errRow(7, 'Could not load payment history.');
  }
});