/**
 * context/AppContext.jsx - The ONE global state of the app (useContext).
 *
 * React lets us share values with every component through a "Context".
 * We chose useContext over Redux because the app only needs to share a few
 * small things: the signed-in user, the chosen login role and toast messages.
 *
 * Anything inside <AppProvider> can read these with  useApp().
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentUser } from '../api/api.js';

// 1. Create the context object (this is the "channel" components tune into).
const AppContext = createContext(null);

/* ── Helper: which page should each role land on after signing in? ── */
export function dashboardPathFor(role) {
  const r = (role || '').toLowerCase();
  if (r === 'client') return '#/client/dashboard';
  if (['firmadmin', 'lawyer', 'intern'].includes(r)) return '#/firm/dashboard';
  if (r === 'superadmin') return '#/superadmin/dashboard';
  return '#/signin';
}

/* ── The provider component: wraps <App /> and owns the shared state ── */
export function AppProvider({ children }) {

  /* The signed-in user object (null = nobody logged in).
     We read it ONCE when the app starts from localStorage. */
  const [user, setUser] = useState(() => getCurrentUser());

  /* The role picked in the landing page "Login" dropdown
     (client / firmadmin / intern). The sign-in page uses it to validate
     the portal and to point the "Sign up" link at the right onboarding. */
  const [loginRole, setLoginRole] = useState(
    () => localStorage.getItem('loginRole') || ''
  );

  /* Toast notifications (small popups bottom-right, like the vanilla app).
     Shape: { id, message, type: 'success' | 'error' } */
  const [toasts, setToasts] = useState([]);

  /* Show a toast for 3.5 seconds. useCallback keeps the same function
     identity between renders so children don't re-render needlessly. */
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random(); // unique key for React lists
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => {
      // Remove only THIS toast when its time is up.
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  /* Called by the SignIn page after a successful backend login. */
  const signIn = (rawUser) => {
    // Backend roles arrive as "firmadmin"; the UI expects "firmAdmin".
    // We normalise once, here, so every page can trust user.role.
    const map = { firmadmin: 'firmAdmin', superadmin: 'superAdmin' };
    const normalized = { ...rawUser, role: map[rawUser?.role] || rawUser?.role || '' };
    localStorage.setItem('currentUser', JSON.stringify(normalized));
    localStorage.setItem('userRole', normalized.role);
    localStorage.removeItem('loginRole'); // one-time use, like the vanilla app
    setUser(normalized);
    return normalized;
  };

  /* Clear every auth artefact and go back to the landing page. */
  const signOut = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('access_token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('loginRole');
    sessionStorage.removeItem('clientDraft');    // half-finished client onboarding
    sessionStorage.removeItem('firmDraft');      // half-finished firm onboarding
    setUser(null);
    window.location.hash = '';                    // back to landing
  };

  /* Keep the role dropdown selection in sync with localStorage so the
     sign-in page can read it after a reload. */
  const chooseLoginRole = (role) => {
    localStorage.setItem('loginRole', role);
    setLoginRole(role);
  };

  /* Sign-out from another browser tab should also clear this tab. */
  useEffect(() => {
    const onStorage = (e) => { if (e.key === 'currentUser') setUser(getCurrentUser()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /* The value every consumer receives. */
  const value = { user, loginRole, chooseLoginRole, signIn, signOut, toast, toasts };

  return (
    <AppContext.Provider value={value}>
      {children}
      {/* Toast stack lives here so it appears on every page. */}
      <ToastStack toasts={toasts} />
    </AppContext.Provider>
  );
}

/* Tiny hook so any component can do:  const { user, toast } = useApp(); */
export function useApp() {
  return useContext(AppContext);
}

/* Renders the floating toasts (bottom-right corner). */
function ToastStack({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-5 py-3 text-sm font-medium text-white shadow-lg transition-all
            ${t.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
