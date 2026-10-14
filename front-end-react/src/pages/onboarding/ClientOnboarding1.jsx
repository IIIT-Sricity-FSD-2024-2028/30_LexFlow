/**
 * Client Onboarding - Step 1: profile creation.
 * Creates the user on the backend right away, then saves a draft copy in
 * sessionStorage (key: clientDraft) that step 2 reads.
 */

import { useState } from 'react';
import OnboardingShell, { FormAlert } from './OnboardingShell.jsx';
import { api } from '../../api/api.js';
import { navigate } from '../../router.jsx';
import { Button, Field, Input } from '../../components/ui.jsx';
import {
  validateName, validateEmail, validateIndianPhone, validatePin,
  validateStreet, validateCity, validateState, validatePassword,
  validateConfirm, passwordScore, normalizeIndianPhone,
} from '../../lib/validators.js';

export default function ClientOnboarding1() {
  /* One state object for the whole form. */
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', street: '', city: '', state: '', zip: '', password: '', confirm: '',
  });
  /* errors holds one message per field (only fields with an error show red). */
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [busy, setBusy] = useState(false);

  /* Small helper to update one field of the form object. */
  const set = (key) => (e) => {
    let { value } = e.target;
    // Simple input masks, exactly like the vanilla version:
    if (key === 'phone') value = value.replace(/[^\d+ ()-]/g, '').slice(0, 15); // phone characters
    if (key === 'zip') value = value.replace(/\D/g, '').slice(0, 6);            // digits only
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: null })); // typing clears the field's error
    setAlert('');
  };

  /* Live password strength meter (0-5 rules passed). */
  const score = passwordScore(form.password);
  const strength = ['Width', ['Weak', 'bg-red-500 w-1/5'], ['Fair', 'bg-orange-500 w-2/5'], ['Moderate', 'bg-yellow-500 w-3/5'], ['Strong', 'bg-green-600 w-4/5'], ['Very Strong', 'bg-green-800 w-full']][score] || ['', 'w-0'];

  /* Check every field; returns true when everything is fine. */
  const validateAll = () => {
    const er = {
      fullName: validateName(form.fullName),
      email: validateEmail(form.email),
      phone: validateIndianPhone(form.phone),
      street: validateStreet(form.street),
      city: validateCity(form.city),
      state: validateState(form.state),
      zip: validatePin(form.zip),
      password: validatePassword(form.password),
      confirm: validateConfirm(form.confirm, form.password),
    };
    setErrors(er);
    return !Object.values(er).some(Boolean); // true when no error strings
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validateAll()) {
      setAlert('Please fix the errors below before continuing.');
      return;
    }
    setBusy(true);
    try {
      // 1. Create the account on the backend.
      await api.users.create(
        {
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          role: 'client',
          password: form.password,
          phone: normalizeIndianPhone(form.phone) || undefined,
        },
        'superadmin' // backend needs this header to allow public account creation
      );

      // 2. Keep a draft so step 2 can merge case info with profile info.
      sessionStorage.setItem('clientDraft', JSON.stringify({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: normalizeIndianPhone(form.phone),
        addressLine1: form.street,
        city: form.city,
        state: form.state,
        pinCode: form.zip,
      }));

      navigate('/onboarding/client/2'); // next step
    } catch (err) {
      setAlert('Failed to create account: ' + (err.message || 'network error. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  /* The 5 password rules displayed as a live checklist. */
  const rules = [
    ['At least 8 characters', form.password.length >= 8],
    ['At least one uppercase letter (A-Z)', /[A-Z]/.test(form.password)],
    ['At least one lowercase letter (a-z)', /[a-z]/.test(form.password)],
    ['At least one number (0-9)', /\d/.test(form.password)],
    ['At least one special character (!@#$%^&*...)', /[^A-Za-z0-9]/.test(form.password)],
  ];

  return (
    <OnboardingShell steps={['Profile', 'Case Details']} current={0}>
      <h1 className="text-2xl font-bold text-slate-900">Create your client account</h1>
      <p className="mt-1 text-sm text-slate-500">Step 1 — tell us who you are.</p>

      <FormAlert message={alert} />

      <form onSubmit={submit} noValidate className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Full Name" required error={errors.fullName}>
          <Input placeholder="John Doe" value={form.fullName} onChange={set('fullName')} error={!!errors.fullName} />
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <Input type="email" placeholder="john@example.com" value={form.email} onChange={set('email')} error={!!errors.email} />
        </Field>
        <Field label="Phone Number" required error={errors.phone}>
          <Input placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} error={!!errors.phone} />
        </Field>
        <Field label="City" required error={errors.city}>
          <Input placeholder="San Francisco" value={form.city} onChange={set('city')} error={!!errors.city} />
        </Field>
        <Field label="Street Address" required error={errors.street} className="md:col-span-2">
          <Input placeholder="123 Legal Way" value={form.street} onChange={set('street')} error={!!errors.street} />
        </Field>
        <Field label="State" required error={errors.state}>
          <Input placeholder="California" value={form.state} onChange={set('state')} error={!!errors.state} />
        </Field>
        <Field label="PIN / Zip Code" required error={errors.zip}>
          <Input placeholder="560001" inputMode="numeric" value={form.zip} onChange={set('zip')} error={!!errors.zip} />
        </Field>

        {/* Password + live strength meter + rules checklist */}
        <Field label="Password" required error={errors.password} className="md:col-span-2">
          <Input type="password" placeholder="Create a strong password" value={form.password}
            onChange={set('password')} error={!!errors.password} autoComplete="new-password" />
          {/* strength bar */}
          <div className="mt-2 h-1 w-full rounded-full bg-slate-100">
            <div className={`h-1 rounded-full transition-all duration-300 ${strength[1] || ''}`} />
          </div>
          <p className="mt-1 text-xs font-semibold" style={{ color: score >= 4 ? '#15803d' : score >= 2 ? '#f57c00' : '#d32f2f' }}>
            {strength[0]}
          </p>
          {/* rules checklist */}
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {rules.map(([label, ok]) => (
              <li key={label} className={`text-xs ${ok ? 'text-green-700' : 'text-slate-400'}`}>
                {ok ? '✓' : '○'} {label}
              </li>
            ))}
          </ul>
        </Field>

        <Field label="Confirm Password" required error={errors.confirm} className="md:col-span-2">
          <Input type="password" placeholder="Re-enter your password" value={form.confirm}
            onChange={set('confirm')} error={!!errors.confirm} autoComplete="new-password" />
        </Field>

        <div className="flex gap-3 pt-2 md:col-span-2">
          <Button variant="ghost" type="button" onClick={() => navigate('/signin')}>Cancel</Button>
          <Button type="submit" loading={busy} className="flex-1">Continue →</Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
