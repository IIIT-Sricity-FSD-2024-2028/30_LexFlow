/**
 * client_billing.js  —  CLIENT view
 *
 * Replaced: all ensureBillingStorage / localStorage calls
 * Added:    loading skeletons, inline error banner, fetch-based data
 */

const { fetchInvoices, fetchPayments, fetchSummary } = window.LexFlowBillingStorage;
const BILLING_TODAY = new Date();

// ── Formatters ────────────────────────────────────────────────────────────────
function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    month: 'short', day: '2-digit', year: 'numeric',
  });
}

function formatCurrency(value) {
  return '₹' + Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

// ── Loading / Error helpers ───────────────────────────────────────────────────
function showTableSkeleton(tbodyId, cols) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: 4 }, () =>
    `<tr>${Array.from({ length: cols }, () =>
      `<td><div class="skeleton skeleton-text"></div></td>`).join('')}</tr>`
  ).join('');
}

function showError(tbodyId, cols, message) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="${cols}" style="text-align:center; padding:32px; color:#ef4444;">
        ⚠ ${message}
      </td>
    </tr>`;
}

function showEmpty(tbodyId, cols, message) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="${cols}" style="text-align:center; padding:32px; color:#6b7280;">
        ${message}
      </td>
    </tr>`;
}

// ── Summary cards ─────────────────────────────────────────────────────────────
function renderSummaryCards(summary) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('valTotalBilled', formatCurrency(summary.totalBilled   ?? 0));
  set('valTotalPaid',   formatCurrency(summary.totalPaid     ?? 0));
  set('valPending',     formatCurrency(summary.pendingAmount ?? 0));
  set('valOverdue',     formatCurrency(summary.overdueAmount ?? 0));
}

// ── Invoice table ─────────────────────────────────────────────────────────────
function renderInvoices(invoices, currentFilter, query) {
  const tbody = document.getElementById('invoicesList');
  if (!tbody) return;

  const q = (query || '').toLowerCase().trim();
  const filtered = invoices.filter(inv => {
    const matchFilter = currentFilter === 'All' || inv.status === currentFilter;
    const matchSearch =
      (inv.id || '').toLowerCase().includes(q) ||
      (inv.caseName || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  if (filtered.length === 0) {
    showEmpty('invoicesList', 7, 'No invoices found.');
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(inv => {
    const badgeClass =
      inv.status === 'Paid'    ? 'badge-paid'    :
      inv.status === 'Pending' ? 'badge-pending' : 'badge-overdue';

    const days   = Math.ceil((new Date(inv.dueDate) - BILLING_TODAY) / 86400000);
    const dueClass =
      inv.status === 'Paid'    ? 'due-green' :
      inv.status === 'Overdue' ? 'due-red'   :
      days <= 14               ? 'due-yellow' : 'due-green';

    const payBtn = inv.status !== 'Paid'
      ? `<button class="btn-pay-now"
           onclick="window.location.href='client_billing_pay-now.html?id=${encodeURIComponent(inv.id)}'">
           Pay Now
         </button>`
      : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="dt-id">${inv.id}</span></td>
      <td><div style="font-weight:600;">${inv.caseName || '-'}</div></td>
      <td style="color:#6b7280;">${inv.advocateName || 'Awaiting Assignment'}</td>
      <td style="font-weight:700; color:#1a1a2e;">${formatCurrency(inv.amount)}</td>
      <td><span class="badge-status ${badgeClass}">${inv.status}</span></td>
      <td class="${dueClass}" style="font-weight:600;">${formatDate(inv.dueDate)}</td>
      <td class="action-cell">${payBtn}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Payment history table (last 3) ────────────────────────────────────────────
function renderPaymentHistory(payments) {
  const tbody = document.getElementById('paymentHistoryList');
  if (!tbody) return;

  if (!payments.length) {
    showEmpty('paymentHistoryList', 6, 'No payment history.');
    return;
  }

  tbody.innerHTML = '';
  payments.slice(0, 3).forEach(pay => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600; color:#1a1a2e;">${pay.id}</td>
      <td><span class="dt-id">${pay.invoiceId}</span></td>
      <td style="font-weight:700; color:#1a1a2e;">${formatCurrency(pay.amount)}</td>
      <td style="color:#6b7280;">${pay.paymentDate ? formatDate(pay.paymentDate) : '-'}</td>
      <td>${pay.paymentMethod || 'Card'}</td>
      <td><span class="badge-status badge-completed">${pay.status || 'Success'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  let invoices = [];
  let payments = [];
  let currentFilter = 'All';

  const searchInput  = document.getElementById('searchInvoiceInput');
  const filterBtns   = document.querySelectorAll('.filter-btn');

  // Show skeletons immediately
  showTableSkeleton('invoicesList',      7);
  showTableSkeleton('paymentHistoryList', 6);

  // Load summary + invoices + payments in parallel
  try {
    const [summary, inv, pay] = await Promise.all([
      fetchSummary(),
      fetchInvoices(),
      fetchPayments(),
    ]);

    invoices = inv;
    payments = pay;

    renderSummaryCards(summary);
    renderInvoices(invoices, currentFilter, '');
    renderPaymentHistory(payments);

  } catch (err) {
    console.error('Billing load error:', err);
    showError('invoicesList',      7, 'Could not load invoices. Is the backend running?');
    showError('paymentHistoryList', 6, 'Could not load payment history.');
  }

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', () =>
      renderInvoices(invoices, currentFilter, searchInput.value));
  }

  // Filter tabs
  filterBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-filter');
      renderInvoices(invoices, currentFilter, searchInput ? searchInput.value : '');
    });
  });
});
