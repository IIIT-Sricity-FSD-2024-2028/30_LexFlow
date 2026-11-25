/**
 * context/AppContext.jsx - Global state interface backed by Redux Toolkit.
 *
 * Provides a backward-compatible useApp() hook for existing components
 * while delegating state management, actions, and reducers to Redux Toolkit.
 */

import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { navigate } from '../router.jsx';
import { SESSION_EXPIRED_EVENT } from '../api/api.js';
import { setUser, setLoginRole, logout, syncUserFromStorage, showToast } from '../store/slices/appSlice.js';

/* ── Helper: which page should each role land on after signing in? ── */
export function dashboardPathFor(role) {
  const r = (role || '').toLowerCase();
  if (r === 'client') return '/client/dashboard';
  if (['firmadmin', 'lawyer', 'intern'].includes(r)) return '/firm/dashboard';
  if (r === 'superadmin') return '/superadmin/dashboard';
  return '/signin';
}

/* ── Backward-compatible hook backed by Redux Toolkit ── */
export function useApp() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.app.user);
  const loginRole = useSelector((state) => state.app.loginRole);
  const toasts = useSelector((state) => state.app.toasts);

  const toast = useCallback(
    (message, type = 'success') => {
      dispatch(showToast(message, type));
    },
    [dispatch]
  );

  const signIn = useCallback(
    (rawUser) => {
      dispatch(setUser(rawUser));
      const map = { firmadmin: 'firmAdmin', superadmin: 'superAdmin' };
      return { ...rawUser, role: map[rawUser?.role] || rawUser?.role || '' };
    },
    [dispatch]
  );

  const signOut = useCallback(() => {
    dispatch(logout());
    navigate('/');
  }, [dispatch]);

  const chooseLoginRole = useCallback(
    (role) => {
      dispatch(setLoginRole(role));
    },
    [dispatch]
  );

  return { user, loginRole, chooseLoginRole, signIn, signOut, toast, toasts };
}

/* ── AppProvider wraps the tree and synchronizes storage events into Redux ── */
export function AppProvider({ children }) {
  const dispatch = useDispatch();
  const toasts = useSelector((state) => state.app.toasts);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'currentUser' || e.key === 'loginRole') {
        dispatch(syncUserFromStorage());
      }
    };
    const onSessionExpired = () => {
      dispatch(logout());
      dispatch(showToast('Your session expired. Please sign in again.', 'error'));
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    };
  }, [dispatch]);

  return (
    <>
      {children}
      <ToastStack toasts={toasts} />
    </>
  );
}

/* Renders floating toasts from Redux store */
function ToastStack({ toasts }) {
  if (!toasts || toasts.length === 0) return null;

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
