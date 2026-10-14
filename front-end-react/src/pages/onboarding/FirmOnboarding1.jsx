/**
 * Firm Onboarding - Step 1: firm core info.
 * Starts a server-side onboarding session (sessionId) and submits step 1.
 * The sessionId + a local draft are kept so steps 2-3 can continue it.
 */

import { useState } from 'react';
import OnboardingShell, { FormAlert } from './OnboardingShell.jsx';
import { api } from '../../api/api.js';
import { navigate } from '../../router.jsx';
import { Button, Field, Input } from '../../components/ui.jsx';
import {
  validateFirmName, validateEmail, validateIndianPhone,
  validatePin, validateStreet, validateCity, validateState, normalizeIndianPhone,
} from '../../lib/validators.js';

export default function FirmOnboarding1() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', street: '', city: '', state: '', zip: '' });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    let { value } = e.target;
    if (key === 'phone') value = value.replace(/\D/g, '').slice(0, 10); // 10 digits max
    if (key === 'zip') value = value.replace(/\D/g, '').slice(0, 6);
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: null }));
    setAlert('');
  };

  const submit = async (e) => {
    e.preventDefault();
    // Validate everything first.
    const er = {
      name: validateFirmName(form.name),
      email: validateEmail(form.email),
      phone: validateIndianPhone(form.phone),
      street: validateStreet(form.street),
      city: validateCity(form.city),
      state: validateState(form.state),
      zip: validatePin(form.zip),
    };
    setErrors(er);
    if (Object.values(er).some(Boolean)) {
      setAlert('Please fix the errors below before continuing.');
      return;
    }

    setBusy(true);
    try {
      // 1. Start (or reuse) a server-side onboarding session.
      let sessionId = sessionStorage.getItem('firmOnboardingSessionId');
      if (!sessionId) {
        const res = await api.users.startOnboarding(); // -> { sessionId }
        sessionId = res.sessionId;
        sessionStorage.setItem('firmOnboardingSessionId', sessionId);
      }

      // 2. Send step-1 data to the backend.
      await api.users.onboardingStep1(sessionId, {
        fullName: form.name.trim(),          // backend field is "fullName"
        email: form.email.trim().toLowerCase(),
        phone: normalizeIndianPhone(form.phone),
        street: form.street,
        city: form.city,
        state: form.state,
        pinCode: form.zip,
      });

      // 3. Keep a local draft (steps 2-3 need phone/address for the fallback path).
      sessionStorage.setItem('firmDraft', JSON.stringify({
        fullName: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: normalizeIndianPhone(form.phone),
        street: form.street, city: form.city, state: form.state, zip: form.zip,
      }));

      navigate('/onboarding/firm/2');
    } catch (err) {
      setAlert(err.message || 'Unable to start onboarding on server');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingShell steps={['Firm Info', 'Contact Info', 'Admin Setup']} current={0}>
      <h1 className="text-2xl font-bold text-slate-900">Register your law firm</h1>
      <p className="mt-1 text-sm text-slate-500">Step 1 — basic firm details.</p>

      <FormAlert message={alert} />

      <form onSubmit={submit} noValidate className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Firm Name" required error={errors.name} className="md:col-span-2">
          <Input placeholder="Firm name" value={form.name} onChange={set('name')} error={!!errors.name} />
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <Input type="email" placeholder="firm email" value={form.email} onChange={set('email')} error={!!errors.email} />
        </Field>
        <Field label="Phone Number" required error={errors.phone}>
          <Input placeholder="9876543210" inputMode="numeric" value={form.phone} onChange={set('phone')} error={!!errors.phone} />
        </Field>
        <Field label="Street Address" required error={errors.street} className="md:col-span-2">
          <Input placeholder="21, Connaught Place" value={form.street} onChange={set('street')} error={!!errors.street} />
        </Field>
        <Field label="City" required error={errors.city}>
          <Input placeholder="New Delhi" value={form.city} onChange={set('city')} error={!!errors.city} />
        </Field>
        <Field label="State" required error={errors.state}>
          <Input placeholder="Delhi" value={form.state} onChange={set('state')} error={!!errors.state} />
        </Field>
        <Field label="PIN / Zip Code" required error={errors.zip}>
          <Input placeholder="110001" inputMode="numeric" value={form.zip} onChange={set('zip')} error={!!errors.zip} />
        </Field>

        <div className="flex gap-3 pt-2 md:col-span-2">
          <Button variant="ghost" type="button" onClick={() => navigate('/signin')}>Cancel</Button>
          <Button type="submit" loading={busy} className="flex-1">Continue →</Button>
        </div>
      </form>

      {/* Logo upload zone (visual feature from the design - choosing a file is
          the only effect, exactly like the vanilla page). */}
      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-slate-400">
        <Input type="file" accept="image/*" className="hidden" onChange={() => {}} />
        <span className="text-sm font-semibold text-slate-600">Upload Firm Logo</span>
        <span className="text-xs text-slate-400">PNG, JPG up to 5MB (Preferred 1:1 ratio)</span>
      </label>
    </OnboardingShell>
  );
}
