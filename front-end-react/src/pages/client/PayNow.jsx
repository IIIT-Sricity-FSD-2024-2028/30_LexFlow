/**
 * Pay Now (client) - checkout page for one invoice with a simulated
 * card payment. Validates card details exactly like the vanilla page:
 *   16-digit grouped card number, MM/YY expiry (not in the past), 3-4 digit CVC.
 * On success: POST /billing/payments/:invoiceId then redirect back to billing.
 */

import { useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import { Breadcrumb } from '../../components/Layout.jsx';
import { Button, Card, PageHeader, Loading, Field, Input } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { money } from '../../lib/format.js';

export default function PayNow({ id }) {
  const { user, toast } = useApp();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  /* Card form state. */
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [errors, setErrors] = useState({});
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [payError, setPayError] = useState('');

  /* Load the invoice we are paying. */
  useEffect(() => {
    (async () => {
      if (!id) { navigate('/client/billing'); return; }
      try {
        const role = (user?.role || 'client').toLowerCase();
        const inv = await api.billing.getInvoice(id, role, {
          'x-user-id': user?.id || '', 'x-user-name': user?.fullName || user?.name || '',
        });
        setInvoice(inv);
      } catch (err) {
        toast('Could not load invoice details: ' + err.message, 'error');
        navigate('/client/billing');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Input formatters (same UX as the vanilla LexValidation helpers) ── */

  // Card number: digits only, grouped in blocks of 4 -> "4242 4242 4242 4242".
  const formatCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  // Expiry: auto-insert the slash -> "12/27".
  const formatExpiry = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
  };

  /* Validate every field; returns true when all good. */
  const validate = () => {
    const er = {
      cardName: cardName.trim() ? (/^[a-zA-Z\s'.,-]{2,80}$/.test(cardName.trim()) ? null : 'Enter a valid cardholder name') : 'Cardholder name is required',
      cardNumber: cardNumber.replace(/\s/g, '').length === 16 ? null : 'Card number must be 16 digits',
      expiry: /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry) ? (() => {
        // "not expired" check: first day AFTER the expiry month must be in the future
        const [mm, yy] = expiry.split('/').map(Number);
        const firstOfNext = new Date(2000 + yy, mm, 1);
        return firstOfNext > new Date() ? null : 'Card has expired';
      })() : 'Use MM/YY format',
      cvc: /^\d{3,4}$/.test(cvc) ? null : 'CVC must be 3-4 digits',
    };
    setErrors(er);
    return !Object.values(er).some(Boolean);
  };

  /* Submit the payment. */
  const pay = async (e) => {
    e.preventDefault();
    setPayError('');
    if (!validate()) {
      setShake(true);                       // shake the form (visual feedback)
      setTimeout(() => setShake(false), 500);
      return;
    }
    setBusy(true);
    try {
      const role = (user?.role || 'client').toLowerCase();
      await api.billing.recordPayment(invoice.id, 'Card', role, {
        'x-user-id': user?.id || '', 'x-user-name': user?.fullName || user?.name || '',
      });
      setDone(true);
      toast('Payment successful!');
      setTimeout(() => navigate('/client/billing'), 1500);
    } catch (err) {
      setPayError(`⚠ Payment failed: ${err.message}`);
      setBusy(false);
    }
  };

  if (loading) return <Loading text="Loading invoice…" />;
  if (!invoice) return null;

  /* Due-date colour: red when past, amber when due within 2 weeks. */
  const dueDate = new Date(invoice.dueDate);
  const days = (dueDate - new Date()) / 86400000;
  const dueColor = days < 0 ? 'text-red-600' : days <= 14 ? 'text-amber-600' : 'text-slate-800';

  return (
    <>
      <Breadcrumb items={[{ label: 'Billing', href: '/client/billing' }, { label: 'Pay Invoice' }]} />
      <PageHeader title="Pay Invoice" subtitle="Complete your payment securely." />

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        {/* ── Invoice summary card ── */}
        <Card className="p-6">
          <h2 className="mb-4 font-bold text-slate-900">Invoice Summary</h2>
          <div className="space-y-3 text-sm">
            <Row label="Invoice ID" value={<span className="font-mono">{invoice.id}</span>} />
            <Row label="Case Name" value={invoice.caseName || '-'} />
            <Row label="Advocate / Firm" value={invoice.advocateName || invoice.clientName || 'Awaiting Assignment'} />
            <Row label="Due Date" value={
              <span className={dueColor}>
                {isNaN(dueDate) ? invoice.dueDate : dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            } />
          </div>
          <div className="mt-6 flex items-center justify-between rounded-xl bg-brand px-4 py-3 text-white">
            <span className="text-sm font-semibold">Total Amount</span>
            <span className="text-xl font-bold">{money(invoice.amount)}</span>
          </div>
        </Card>

        {/* ── Payment form card ── */}
        <Card className={`p-6 ${shake ? 'form-shake' : ''}`}>
          {done ? (
            /* success state replaces the form */
            <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
              <Icon name="check" size={40} className="text-emerald-500" />
              <p className="font-bold text-slate-900">Payment Successful!</p>
              <p className="text-sm text-slate-500">You are being redirected shortly…</p>
            </div>
          ) : (
            <form onSubmit={pay} noValidate>
              <h2 className="mb-4 font-bold text-slate-900">Payment Details</h2>

              <div className="space-y-4">
                <Field label="Cardholder Name" required error={errors.cardName}>
                  <Input value={cardName} maxLength={80}
                    onChange={(e) => setCardName(e.target.value.replace(/[^a-zA-Z\s'.,-]/g, ''))}
                    error={!!errors.cardName} placeholder="Name on card" />
                </Field>
                <Field label="Card Number" required error={errors.cardNumber}>
                  <Input value={cardNumber} inputMode="numeric" placeholder="4242 4242 4242 4242"
                    onChange={(e) => setCardNumber(formatCard(e.target.value))} error={!!errors.cardNumber} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Expiry" required error={errors.expiry}>
                    <Input value={expiry} inputMode="numeric" placeholder="MM/YY" maxLength={5}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))} error={!!errors.expiry} />
                  </Field>
                  <Field label="CVC" required error={errors.cvc}>
                    <Input type="password" value={cvc} inputMode="numeric" maxLength={4} placeholder="•••"
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))} error={!!errors.cvc} />
                  </Field>
                </div>
              </div>

              {payError && <p className="mt-3 text-sm font-medium text-red-600">{payError}</p>}

              <Button type="submit" loading={busy} className="mt-6 w-full">
                Pay {money(invoice.amount)} securely
              </Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}

/* One label/value row in the summary card. */
function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}