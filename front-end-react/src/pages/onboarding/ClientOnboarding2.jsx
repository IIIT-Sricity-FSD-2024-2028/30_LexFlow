/**
 * Client Onboarding - Step 2: optional case details, then finish.
 * The user is already created server-side (step 1). Here we just collect
 * optional info, sign the client in locally, and go to the dashboard.
 */

import { useState } from 'react';
import OnboardingShell, { FormAlert } from './OnboardingShell.jsx';
import { navigate } from '../../router.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { Button, Field, Input, Select, Textarea } from '../../components/ui.jsx';

export default function ClientOnboarding2() {
  const { signIn, toast } = useApp();

  const [form, setForm] = useState({ caseType: '', courtName: '', cnr: '', description: '' });
  const [alert, setAlert] = useState('');

  /* Update one field of the form. */
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  /* finish(caseData): reads the step-1 draft, signs the user in, moves on. */
  const finish = (caseData) => {
    const draft = JSON.parse(sessionStorage.getItem('clientDraft') || 'null');
    if (!draft?.fullName || !draft?.email) {
      setAlert('Profile data is missing. Please go back to Step 1.');
      return;
    }
    // Sign the client in (same shape the login page would produce).
    signIn({ id: draft.id || draft.email, fullName: draft.fullName, email: draft.email, role: 'client' });
    sessionStorage.removeItem('clientDraft');      // draft no longer needed
    toast('Account created successfully! Redirecting…');
    setTimeout(() => navigate('/client/dashboard'), 400); // tiny delay so the toast is visible
  };

  /* Submit = save case details then finish. All step-2 fields are optional. */
  const submit = (e) => {
    e.preventDefault();
    // (In the full backend flow these fields would be attached to a case.)
    finish(form);
  };

  return (
    <OnboardingShell steps={['Profile', 'Case Details']} current={1}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tell us about your case</h1>
          <p className="mt-1 text-sm text-slate-500">This step is optional — you can add details later.</p>
        </div>
        {/* Skip = finish immediately with no case data */}
        <Button variant="outline" onClick={() => finish({})}>Skip →</Button>
      </div>

      <FormAlert message={alert} />

      <form onSubmit={submit} noValidate className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Case Type">
          <Select value={form.caseType} onChange={set('caseType')}>
            <option value="">Select Case Category</option>
            <option value="civil">Civil</option>
            <option value="criminal">Criminal</option>
            <option value="family">Family</option>
            <option value="property">Property</option>
            <option value="corporate">Corporate</option>
          </Select>
        </Field>
        <Field label="Court Name">
          <Input placeholder="e.g. High Court of Mumbai" value={form.courtName} onChange={set('courtName')} />
        </Field>
        <Field label="CNR Number (Optional)" className="md:col-span-2">
          <Input placeholder="Enter 16-digit CNR Number" maxLength={16} value={form.cnr} onChange={set('cnr')} />
        </Field>
        <Field label="Brief Description" className="md:col-span-2">
          <Textarea rows={4} placeholder="Briefly describe the nature of your legal matter..." value={form.description} onChange={set('description')} />
        </Field>

        <div className="flex gap-3 pt-2 md:col-span-2">
          <Button variant="outline" type="button" onClick={() => navigate('/onboarding/client/1')}>← Back</Button>
          <Button type="submit" className="flex-1">Submit Case Info →</Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
