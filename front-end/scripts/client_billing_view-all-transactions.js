/**
 * client_billing_view-all-transactions.js
 *
 * Replaced: ensureBillingStorage, all localStorage reads
 * Added:    fetch from GET /billing/payments, loading skeleton, error state
 */

const { fetchPayments } = window.LexFlowBillingStorage;

document.addEventListener('DOMContentLoaded', async () => {
  const tbody = document.getElementById('allTransactionsList');
  if (!tbody) return;

  // ── Loading skeleton ────────────────────────────────────────────────────────
  tbody.innerHTML = Array.from({ length: 5 }, () =>
    `<tr>${Array.from({ length: 6 }, () =>
      `<td><div class="skeleton skeleton-text"></div></td>`).join('')}</tr>`
  ).join('');

  try {
    const payments = await fetchPayments();

    if (!payments.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color:#6b7280; padding:40px;">
            No transactions found.
          </td>
        </tr>`;
      return;
    }

    // Sort newest first
    payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    tbody.innerHTML = '';
    payments.forEach(tx => {
      const isBank  = (tx.paymentMethod || '').toLowerCase().includes('bank');
      const methodIcon = isBank
        ? `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px;height:16px;">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
               d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
           </svg>`
        : `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px;height:16px;">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
               d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
           </svg>`;

      const formattedDate = tx.paymentDate
        ? new Date(tx.paymentDate).toLocaleDateString('en-IN', {
            month: 'short', day: '2-digit', year: 'numeric',
          })
        : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600; color:#1a1a2e;">${tx.id}</td>
        <td><span class="dt-id">${tx.invoiceId}</span></td>
        <td style="font-weight:700; color:#1a1a2e;">
          ₹${Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
        <td style="color:#6b7280;">${formattedDate}</td>
        <td>
          <div class="pay-method" style="display:flex; align-items:center; gap:8px;">
            ${methodIcon} ${tx.paymentMethod || 'Card'}
          </div>
        </td>
        <td><span class="badge-status badge-completed">${tx.status || 'Success'}</span></td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error('Transactions load error:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:32px; color:#ef4444;">
          ⚠ Could not load transactions. Is the backend running?
        </td>
      </tr>`;
  }
});
