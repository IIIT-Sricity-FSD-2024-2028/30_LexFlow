/** Optional case details after the client has signed in. */
import { useState } from 'react';
import OnboardingShell, { FormAlert } from './OnboardingShell.jsx';
import { navigate } from '../../router.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { Button, Field, Input, Select, Textarea } from '../../components/ui.jsx';

export default function ClientOnboarding2() {
  const { user, toast } = useApp();

  const [form, setForm] = useState({ caseType: '', courtName: '', cnr: '', description: '' });
  const [alert, setAlert] = useState('');

  /* Update one field of the form. */
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const finish = () => {
    if (user?.role !== 'client') {
      setAlert('Please sign in to continue.');
      return;
    }
    toast('Account created successfully!');
    navigate('/client/dashboard');
  };

  /* Submit = save case details then finish. All step-2 fields are optional. */
  const submit = (e) => {
    e.preventDefault();
    // (In the full backend flow these fields would be attached to a case.)
    finish();
  };

  return (
    <OnboardingShell steps={['Profile', 'Case Details']} current={1}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tell us about your case</h1>
          <p className="mt-1 text-sm text-slate-500">This step is optional — you can add details later.</p>
        </div>
        {/* Skip = finish immediately with no case data */}
        <Button variant="outline" onClick={finish}>Skip →</Button>
      </div>

      <FormAlert message={alert} />

      <form onSubmit={submit} noValidate className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Case Type">
          <Select value={form.caseType} onChange={set('caseType')}>
            <option value="">Select Case Category</option>
            <option value="civil">Civil</option>
            <option value="criminal">Criminal</option>
            <option value="corporate">Corporate</option>
            <option value="family">Family</option>
            <option value="ip">Intellectual Property</option>
          </Select>
        </Field>
        <Field label="Court Name">
          <Input placeholder="High Court of Delhi" value={form.courtName} onChange={set('courtName')} />
        </Field>
        <Field label="CNR Number (if assigned)" className="md:col-span-2">
          <Input placeholder="DLDH01-123456-2026" value={form.cnr} onChange={set('cnr')} />
        </Field>
        <Field label="Brief Description" className="md:col-span-2">
          <Textarea rows={3} placeholder="Provide a brief overview of your legal situation…" value={form.description} onChange={set('description')} />
        </Field>

        <div className="flex gap-3 pt-2 md:col-span-2">
          <Button variant="ghost" type="button" onClick={() => navigate('/onboarding/client/1')}>← Back</Button>
          <Button type="submit" className="flex-1">Finish & Go to Dashboard →</Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
