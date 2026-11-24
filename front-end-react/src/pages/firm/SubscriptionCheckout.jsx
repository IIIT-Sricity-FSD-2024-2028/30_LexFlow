import { useState } from 'react';
import { Button, Field, Input, Modal } from '../../components/ui.jsx';
import { money } from '../../lib/format.js';
import { formatCardNumber, formatCardExpiry, validateCardDetails } from '../../lib/validators.js';

const TEST_CARDS = {
  '4242 4242 4242 4242': 'test-4242',
  '4000 0000 0000 0002': 'test-0002',
};
const FORM_ID = 'subscription-checkout';

export default function SubscriptionCheckout({ charge, busy, onClose, onConfirm }) {
  const [card, setCard] = useState({ cardName: '', cardNumber: '', expiry: '', cvc: '' });
  const [errors, setErrors] = useState({});
  const [saveCard, setSaveCard] = useState(false);

  const update = (field, value) => {
    setCard((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: null }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    const validation = validateCardDetails(card);
    const paymentMethod = TEST_CARDS[card.cardNumber];
    if (!validation.cardNumber && !paymentMethod) {
      validation.cardNumber = 'Enter a supported test card number.';
    }
    setErrors(validation);
    if (Object.values(validation).some(Boolean)) return;

    onConfirm(!charge || saveCard ? paymentMethod : undefined);
  };

  return (
    <Modal open title={charge ? 'Pay subscription charge' : 'Save payment method'} onClose={busy ? undefined : onClose}
      footer={<>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button type="submit" form={FORM_ID} loading={busy} disabled={busy}>
          {charge ? 'Pay ' + money(charge.amount) : 'Save and enable renewal'}
        </Button>
      </>}>
      {charge && <div className="mb-4 flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{charge.targetTier || charge.tier} subscription</p>
          <p className="text-xs text-slate-500">{charge.period}</p>
        </div>
        <p className="shrink-0 font-bold text-slate-900">{money(charge.amount)}</p>
      </div>}
      <p className="mb-4 text-xs text-slate-600">
        Enter test card details.
      </p>
      <form id={FORM_ID} autoComplete="off" noValidate onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-4">
          <Field label="Cardholder name" required error={errors.cardName}>
            <Input value={card.cardName} maxLength={80} placeholder="Name on card" error={!!errors.cardName}
              aria-invalid={!!errors.cardName} onChange={(e) => update('cardName', e.target.value)} />
          </Field>
          <Field label="Card number" required error={errors.cardNumber}>
            <Input value={card.cardNumber} inputMode="numeric" error={!!errors.cardNumber}
              aria-invalid={!!errors.cardNumber} onChange={(e) => update('cardNumber', formatCardNumber(e.target.value))} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Expiry date" required error={errors.expiry}>
              <Input value={card.expiry} inputMode="numeric" placeholder="MM/YY" error={!!errors.expiry}
                aria-invalid={!!errors.expiry} onChange={(e) => update('expiry', formatCardExpiry(e.target.value))} />
            </Field>
            <Field label="CVC" required error={errors.cvc}>
              <Input type="password" value={card.cvc} inputMode="numeric" error={!!errors.cvc}
                aria-invalid={!!errors.cvc} onChange={(e) => update('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </Field>
          </div>
          {charge && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} />
              Save test card and enable automatic renewal
            </label>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
