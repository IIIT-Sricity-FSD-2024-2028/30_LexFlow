/**
 * pages/SignIn.jsx - The login form (replaces sign-in.html + signin.js).
 *
 * Flow:
 *  1. User picked a role on the landing page dropdown (stored as loginRole).
 *  2. POST /users/login with email + password.
 *  3. Check the returned role matches the portal (client portal rejects
 *     firm staff and vice-versa) - same rule as the vanilla app.
 *  4. Save user in context/localStorage and redirect to the role dashboard.
 */

import { useState } from 'react';
import { useApp, dashboardPathFor } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import { api } from '../api/api.js';
import { Button, Card, Field, Input } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

export default function SignIn() {
  const { loginRole, signIn, toast } = useApp();

  /* Form fields + UI state (submitting / error message). */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* The "Sign up" link points to the right onboarding based on chosen role. */
  const isClientPortal = loginRole === 'client';
  const signupHref = isClientPortal ? '#/onboarding/client/1' : '#/onboarding/firm/1';

  /* Handle the form submit. */
  const submit = async (e) => {
    e.preventDefault();                 // stop the browser's normal form post
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setBusy(true);
    try {
      // Ask the backend to verify the credentials.
      const user = await api.auth.login(email.trim(), password);
      const role = (user?.role || '').toLowerCase();

      // Portal check: the client portal only accepts clients, and the
      // firm portal only accepts firm staff (admin / lawyer / intern).
      if (isClientPortal && role !== 'client') throw new Error('This login portal is only for clients.');
      if (['firmadmin', 'intern'].includes(loginRole) && !['firmadmin', 'lawyer', 'intern'].includes(role)) {
        throw new Error('This login portal is only for law firm staff (Admin/Lawyer/Intern).');
      }

      signIn(user); // stores user + normalises role
      toast('Welcome back, ' + (user.fullName || user.name || 'User') + '!');
      navigate(dashboardPathFor(role).replace('#', '')); // go to the role's dashboard
    } catch (err) {
      setError(err.message || 'Unable to sign in right now. Please check backend server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      {/* Logo back to landing */}
      <a href="#/" className="fixed left-6 top-5 text-xl font-extrabold text-brand">LexFlow</a>

      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-slate-900">Sign-in</h1>
        {loginRole && (
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">
            {isClientPortal ? 'Client portal' : 'Law firm portal'}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email Address" required>
            <Input type="email" placeholder="john@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="Password" required>
            <Input type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>

          {/* Red error box (login failed) */}
          {error && (
            <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              <Icon name="alert" size={15} /> {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => navigate('/')}>Cancel</Button>
            <Button type="submit" loading={busy} className="flex-1">Sign In →</Button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Do not have an account? Create One.
          <br />
          <a href={signupHref} className="font-semibold text-indigo-500 hover:underline">Sign Up</a>
        </p>
      </Card>
    </div>
  );
}
