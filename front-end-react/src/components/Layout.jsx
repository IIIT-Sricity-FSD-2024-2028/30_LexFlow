/**
 * components/Layout.jsx - The wrapper for every page that needs the sidebar.
 *
 * It also ACTS AS THE AUTH GUARD (replaces AuthService.requireAuth in vanilla):
 *   1. Nobody logged in          -> send to the sign-in page.
 *   2. Role not in `roles` list  -> send to that role's own dashboard.
 *      (superadmin is allowed everywhere, exactly like the vanilla rule.)
 *
 * Usage in App.jsx:  <Layout roles={['client']}><ClientDashboard/></Layout>
 */

import { useEffect, useState } from 'react';
import { useApp, dashboardPathFor } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import Sidebar from './Sidebar.jsx';
import Icon from './Icon.jsx';

export default function Layout({ roles = [], children }) {
  const { user } = useApp();
  const [menuOpen, setMenuOpen] = useState(false); // mobile hamburger state

  /* Read the current hash (e.g. "/client/cases") for the active-link check.
     We re-read it on every render because the parent re-renders on route change. */
  const currentPath = window.location.hash.replace(/^#/, '') || '/';

  useEffect(() => {
    // Case 1: visitor is not logged in at all.
    if (!user) {
      navigate('/signin');
      return;
    }
    // Case 2: logged in, but this page is for a different role.
    // superadmin bypasses every gate (same rule as the vanilla app).
    const r = (user.role || '').toLowerCase();
    if (roles.length > 0 && r !== 'superadmin' && !roles.includes(r)) {
      navigate(dashboardPathFor(r).replace('#', '')); // go to own dashboard
    }
  }, [user, roles]);

  // While redirecting (no user) render nothing to avoid a flash of content.
  if (!user) return null;

  return (
    <div className="min-h-screen bg-page">
      <Sidebar currentPath={currentPath} open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Dark overlay behind the sidebar on mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* Top bar visible on small screens (hamburger button) */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-white px-4 py-3 shadow-sm md:hidden">
        <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="rounded-lg p-2 hover:bg-slate-100">
          <Icon name="menu" />
        </button>
        <span className="font-bold text-brand">LexFlow</span>
      </div>

      {/* Main content area, shifted right on desktop to make room for the sidebar */}
      <main className="min-h-screen px-4 py-6 md:ml-64 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

/* A small breadcrumb row ("Cases / CNR: 1234") used by detail pages. */
export function Breadcrumb({ items }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-slate-300">/</span>}
          {item.href ? (
            <a href={`#${item.href}`} className="hover:text-brand hover:underline">{item.label}</a>
          ) : (
            <span className="font-semibold text-slate-700">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
