/**
 * Firm Onboarding - Step 3: admin profile + plan (tier) selection.
 * Completes the server-side session, signs the firm admin in, and opens billing.
 */

import { useEffect, useState } from 'react';
import OnboardingShell, { FormAlert } from './OnboardingShell.jsx';
import { api } from '../../api/api.js';
import { navigate } from '../../router.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { Button, Field, Input } from '../../components/ui.jsx';
import {
  validateName, validateEmail, validatePassword, validateConfirm, passwordScore,
  formatAadhaar, validateAadhaar,
} from '../../lib/validators.js';

export default function FirmOnboarding3() {
  const { signIn, toast } = useApp();

  const [plans, setPlans] = useState([]);         // tier cards from the backend
  const [plansError, setPlansError] = useState('');
  const [selectedTier, setSelectedTier] = useState('Starter'); // default plan
  const [form, setForm] = useState({ adminName: '', adminEmail: '', adminAadhaar: '', password: '', confirm: '', terms: false });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [busy, setBusy] = useState(false);

  /* Load the pricing tiers for the plan picker. */
  useEffect(() => {
    api.platform.getTierPlans('firmadmin')
      .then((data) => setPlans(Array.isArray(data) ? data : data?.tiers || []))
      .catch(() => setPlansError('Could not load plans — you can change your plan later from billing.'));
  }, []);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: null }));
    setAlert('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = {
      adminName: validateName(form.adminName, { twoWords: false }),
      adminEmail: validateEmail(form.adminEmail),
      adminAadhaar: validateAadhaar(form.adminAadhaar, { required: false }),
      password: validatePassword(form.password),
      confirm: validateConfirm(form.confirm, form.password),
      terms: form.terms ? null : 'Please accept the Terms of Service.',
    };
    setErrors(er);
    if (Object.values(er).some(Boolean)) {
      setAlert('Please fix the errors below before continuing.');
      return;
    }

    setBusy(true);
    try {
      const sessionId = sessionStorage.getItem('firmOnboardingSessionId');
      if (!sessionId) throw new Error('Start from Firm Info to set up your firm admin account.');
      const body = {
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim().toLowerCase(),
        adminAadhaar: form.adminAadhaar || undefined,
        password: form.password,
        confirmPassword: form.confirm,
        tier: selectedTier,
      };

      const result = await api.users.onboardingStep3(sessionId, body);
      const adminUser = {
        id: result.adminUserId,
        fullName: body.adminName,
        email: body.adminEmail,
        role: 'firmadmin',
        firmId: result.firmId,
        firmName: result.name,
      };

      // Clean up the wizard's temporary storage.
      sessionStorage.removeItem('firmDraft');
      sessionStorage.removeItem('firmOnboardingSessionId');

      const authenticatedAdmin = await api.auth.login(body.adminEmail, body.password).catch(() => null);
      if (!authenticatedAdmin) {
        toast('Firm account created. Sign in to start your subscription.');
        navigate('/signin');
        return;
      }
      signIn({ ...adminUser, ...authenticatedAdmin });
      toast('Firm account created. Start your subscription in Billing.');
      navigate('/firm/billing');
    } catch (err) {
      setAlert(err.message || 'Unable to complete onboarding on server');
    } finally {
      setBusy(false);
    }
  };

  /* Live password rules (same 4-of-5 rule as the client flow). */
  const score = passwordScore(form.password);

  return (
    <OnboardingShell steps={['Firm Info', 'Contact Info', 'Admin Setup']} current={2}>
      <h1 className="text-2xl font-bold text-slate-900">Firm Admin Profile</h1>
      <p className="mt-1 text-sm text-slate-500">This account manages the firm and its subscription.</p>

      <FormAlert message={alert} />

      {/* ── Plan (tier) picker ── */}
      <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Choose your plan</p>
      {plansError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{plansError}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((p) => (
            <button
              type="button"
              key={p.tier}
              onClick={() => setSelectedTier(p.tier)}
              className={`rounded-xl border-2 p-4 text-left transition
                ${selectedTier === p.tier ? 'border-brand bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <p className="font-bold text-slate-800">{p.tier}</p>
              <p className="mt-1 text-sm text-slate-600">
                ₹{Number(p.monthlyPrice).toLocaleString('en-IN')}/mo
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {p.lawyerSeats >= 10000 ? 'Unlimited' : p.lawyerSeats} lawyers ·{' '}
                {p.internSeats >= 10000 ? 'Unlimited' : p.internSeats} interns
              </p>
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Your first payment starts your monthly billing period. Manage your plan and renewal in Firm Billing.
      </p>

      {/* ── Admin account form ── */}
      <form onSubmit={submit} noValidate className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Admin Full Name" required error={errors.adminName}>
          <Input placeholder="Rahul Verma" value={form.adminName} onChange={set('adminName')} error={!!errors.adminName} />
        </Field>
        <Field label="Admin Email Address" required error={errors.adminEmail}>
          <Input type="email" placeholder="rahul.verma@lawfirm.in" value={form.adminEmail} onChange={set('adminEmail')} error={!!errors.adminEmail} />
        </Field>
        <Field label="Admin Aadhaar Number" error={errors.adminAadhaar} className="md:col-span-2">
          <Input inputMode="numeric" maxLength={14} value={form.adminAadhaar}
            onChange={(e) => {
              setForm((f) => ({ ...f, adminAadhaar: formatAadhaar(e.target.value) }));
              setErrors((er) => ({ ...er, adminAadhaar: null }));
              setAlert('');
            }}
            error={!!errors.adminAadhaar} />
          <p className="mt-1 text-xs text-slate-500">Optional. Only the last four digits are saved.</p>
        </Field>
        <Field label="Password" required error={errors.password}>
          <Input type="password" placeholder="Create a strong password" value={form.password}
            onChange={set('password')} error={!!errors.password} autoComplete="new-password" />
          {form.password && (
            <p className={`mt-1 text-xs font-semibold ${score >= 4 ? 'text-green-700' : 'text-amber-600'}`}>
              {score}/5 password rules satisfied
            </p>
          )}
        </Field>
        <Field label="Confirm Password" required error={errors.confirm}>
          <Input type="password" placeholder="Re-enter your password" value={form.confirm}
            onChange={set('confirm')} error={!!errors.confirm} autoComplete="new-password" />
        </Field>

        {/* Terms checkbox */}
        <label className="flex items-start gap-2 md:col-span-2">
          <input type="checkbox" checked={form.terms} onChange={set('terms')}
            className={`mt-1 h-4 w-4 rounded border-slate-300 ${errors.terms ? 'outline outline-red-400' : ''}`} />
          <span className={`text-xs ${errors.terms ? 'text-red-600' : 'text-slate-600'}`}>
            I agree to the Terms of Service, Privacy Policy, and the firm management data processing agreement.
            {errors.terms && <span className="block font-semibold">{errors.terms}</span>}
          </span>
        </label>

        <div className="flex gap-3 pt-2 md:col-span-2">
          <Button variant="outline" type="button" onClick={() => navigate('/onboarding/firm/2')}>Back</Button>
          <Button type="submit" loading={busy} className="flex-1">Create Firm Account</Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
