/**
 * client_billing_pay-now.js  —  CLIENT payment page
 *
 * Replaced: localStorage read/write, saveBillingToAllStores, generatePaymentId
 * Added:    fetch-based recordPayment, loading state on submit button,
 *           error banner on API failure
 */

const { fetchInvoice: fetchInvoiceById, recordPayment } = window.LexFlowBillingStorage;
const BILLING_TODAY = new Date();

function formatLongDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatCurrency(value) {
  return '₹' + Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const invoiceId = new URLSearchParams(window.location.search).get('id');
  if (!invoiceId) {
    alert('No invoice ID provided. Redirecting to billing dashboard.');
    window.location.href = 'client_billing.html';
    return;
  }

  let currentInvoice = null;

  // ── Load invoice from backend ───────────────────────────────────────────────
  try {
    currentInvoice = await fetchInvoiceById(invoiceId);

    if (!currentInvoice) {
      alert('Invoice not found.');
      window.location.href = 'client_billing.html';
      return;
    }

    // Populate summary card
    document.getElementById('summaryId').textContent       = currentInvoice.id;
    document.getElementById('summaryCaseName').textContent = currentInvoice.caseName || '-';
    document.getElementById('summaryLawFirm').textContent  = currentInvoice.advocateName || 'Awaiting Assignment';

    const days = Math.ceil((new Date(currentInvoice.dueDate) - BILLING_TODAY) / 86400000);
    const dueDateEl = document.getElementById('summaryDueDate');
    dueDateEl.textContent  = formatLongDate(currentInvoice.dueDate);
    dueDateEl.style.color  = days < 0 ? '#ef4444' : days <= 14 ? '#f59e0b' : '#1a1a2e';

    const formatted = formatCurrency(currentInvoice.amount);
    document.getElementById('summaryAmount').textContent = formatted;
    document.getElementById('btnPayAmount').textContent  = formatted;

  } catch (err) {
    console.error('Failed to load invoice:', err);
    alert('Could not load invoice details. Please check if the backend is running.');
    window.location.href = 'client_billing.html';
    return;
  }

  // ── Form inputs ─────────────────────────────────────────────────────────────
  const cardNameInput  = document.getElementById('cardName');
  const cardNumberInput = document.getElementById('cardNumber');
  const cardExpiryInput = document.getElementById('cardExpiry');
  const cardCvcInput   = document.getElementById('cardCVC');
  const paymentForm    = document.getElementById('paymentForm');
  const paymentSuccess = document.getElementById('paymentSuccess');

  // Re-use existing LexValidation helpers (shared_form-validation.js)
  if (window.LexValidation) {
    LexValidation.formatNameInput(cardNameInput);
    LexValidation.attachBlurValidation(cardNameInput,
      v => LexValidation.validateName(v, 'Cardholder name'));
    LexValidation.formatCardNumberInput(cardNumberInput);
    LexValidation.formatExpiryInput(cardExpiryInput);
    LexValidation.formatCVCInput(cardCvcInput);
  }

  // ── Submit handler ──────────────────────────────────────────────────────────
  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (window.LexValidation) {
      LexValidation.clearAllErrors(paymentForm);
      const fields = [
        { input: cardNameInput,   validator: v => LexValidation.validateName(v, 'Cardholder name') },
        { input: cardNumberInput, validator: LexValidation.validateCardNumber },
        { input: cardExpiryInput, validator: LexValidation.validateExpiry },
        { input: cardCvcInput,    validator: LexValidation.validateCVC },
      ];
      if (!LexValidation.validateForm(fields)) {
        const card = paymentForm.closest('.checkout-form');
        if (card) {
          card.classList.add('form-shake');
          setTimeout(() => card.classList.remove('form-shake'), 450);
        }
        return;
      }
    }

    // ── Loading state ─────────────────────────────────────────────────────────
    const submitBtn = paymentForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled   = true;
    submitBtn.textContent = 'Processing…';

    // Remove any previous error banner
    document.getElementById('payError')?.remove();

    try {
      await recordPayment(invoiceId, 'Card');

      paymentForm.style.display  = 'none';
      paymentSuccess.style.display = 'block';

      setTimeout(() => {
        window.location.href = 'client_billing.html';
      }, 3000);

    } catch (err) {
      console.error('Payment failed:', err);

      // Re-enable button
      submitBtn.disabled  = false;
      submitBtn.innerHTML = originalText;

      // Inline error banner
      const banner = document.createElement('p');
      banner.id    = 'payError';
      banner.style.cssText = 'color:#ef4444; margin-top:12px; font-size:13px;';
      banner.textContent   = '⚠ Payment failed: ' + err.message;
      paymentForm.appendChild(banner);
    }
  });
});
