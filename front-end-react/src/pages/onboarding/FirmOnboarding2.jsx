/**
 * Firm Onboarding - Step 2: primary contact details.
 * Sends { primaryEmail, website, phone } to the backend session.
 */

import { useState } from 'react';
import OnboardingShell, { FormAlert } from './OnboardingShell.jsx';
import { api } from '../../api/api.js';
import { navigate } from '../../router.jsx';
import { Button, Field, Input } from '../../components/ui.jsx';
import { validateEmail, validateIndianPhone, validateWebsite, normalizeIndianPhone } from '../../lib/validators.js';

export default function FirmOnboarding2() {
  const [form, setForm] = useState({ primaryEmail: '', phone: '', website: '' });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    let { value } = e.target;
    if (key === 'phone') value = value.replace(/\D/g, '').slice(0, 10);
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: null }));
    setAlert('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = {
      primaryEmail: validateEmail(form.primaryEmail),
      phone: validateIndianPhone(form.phone),
      website: validateWebsite(form.website), // optional field
    };
    setErrors(er);
    if (Object.values(er).some(Boolean)) {
      setAlert('Please fix the errors below before continuing.');
      return;
    }

    setBusy(true);
    try {
      const sessionId = sessionStorage.getItem('firmOnboardingSessionId');
      const payload = {
        primaryEmail: form.primaryEmail.trim().toLowerCase(),
        website: form.website.trim(),
        phone: normalizeIndianPhone(form.phone),
      };

      if (sessionId) {
        // Continue the server-side session.
        await api.users.onboardingStep2(sessionId, payload);
      }

      // Merge into the local draft as well.
      const draft = JSON.parse(sessionStorage.getItem('firmDraft') || '{}');
      sessionStorage.setItem('firmDraft', JSON.stringify({ ...draft, ...payload, contactPhone: payload.phone }));

      navigate('/onboarding/firm/3');
    } catch (err) {
      setAlert(err.message || 'Unable to submit contact info to server');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingShell steps={['Firm Info', 'Contact Info', 'Admin Setup']} current={1}>
      <h1 className="text-2xl font-bold text-slate-900">Primary Contact Details</h1>
      <p className="mt-1 text-sm text-slate-500">How should clients reach your firm?</p>

      <FormAlert message={alert} />

      <form onSubmit={submit} noValidate className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Primary Email" required error={errors.primaryEmail}>
          <Input type="email" placeholder="e.g. contact@firm.com" value={form.primaryEmail} onChange={set('primaryEmail')} error={!!errors.primaryEmail} />
        </Field>
        <Field label="Phone Number" required error={errors.phone}>
          <Input placeholder="9876543210" inputMode="numeric" value={form.phone} onChange={set('phone')} error={!!errors.phone} />
        </Field>
        <Field label="Website URL" error={errors.website} className="md:col-span-2">
          <Input type="url" placeholder="https://www.yourfirm.com" value={form.website} onChange={set('website')} error={!!errors.website} />
        </Field>

        <div className="flex gap-3 pt-2 md:col-span-2">
          <Button variant="outline" type="button" onClick={() => navigate('/onboarding/firm/1')}>← Back</Button>
          <Button type="submit" loading={busy} className="flex-1">Continue →</Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
