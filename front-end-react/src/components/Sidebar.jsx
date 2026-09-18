/**
 * components/Sidebar.jsx - The left navigation shown on every dashboard page.
 *
 * One component replaces the vanilla sidebar.html + sidebar.js pair.
 * The links it shows depend on the signed-in role:
 *   client     -> Consultations, Cases, Documents, Billing, Find a Law Firm
 *   firm staff -> Consultations, Cases, Documents, Billing (not intern), User Mgmt (admin only)
 *   superadmin -> Overview, Revenue, Law Firms, Lawyers, Users, Consultations, Invoices, Settings
 */

import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/api.js';
import Icon from './Icon.jsx';
import { roleLabel } from '../lib/format.js';

/* One navigation entry: { to: hash route, label, icon } */
const CLIENT_NAV = [
  { to: '/client/dashboard', label: 'Consultations', icon: 'calendar' },
  { to: '/client/cases', label: 'Cases', icon: 'briefcase' },
  { to: '/documents', label: 'Documents', icon: 'document' },
  { to: '/client/billing', label: 'Billing', icon: 'dollar' },
  { to: '/client/search', label: 'Find a Law Firm', icon: 'search' },
];

const FIRM_NAV = [
  { to: '/firm/dashboard', label: 'Consultations', icon: 'calendar' },
  { to: '/firm/cases', label: 'Cases', icon: 'briefcase' },
  { to: '/documents', label: 'Documents', icon: 'document' },
  { to: '/firm/billing', label: 'Billing', icon: 'dollar' },
  { to: '/firm/users', label: 'User Management', icon: 'users', onlyAdmin: true },
];

const SUPER_NAV = [
  { to: '/superadmin/dashboard', label: 'Overview', icon: 'grid' },
  { to: '/superadmin/revenue', label: 'Revenue', icon: 'dollar' },
  { to: '/superadmin/firms', label: 'Law Firms', icon: 'building' },
  { to: '/superadmin/lawyers', label: 'Lawyers', icon: 'user' },
  { to: '/superadmin/users', label: 'Users', icon: 'users' },
  { to: '/superadmin/consultations', label: 'Consultations', icon: 'calendar' },
  { to: '/superadmin/invoices', label: 'Invoices', icon: 'document' },
  { to: '/superadmin/settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar({ currentPath, open, onClose }) {
  const { user, signOut } = useApp();
  const role = (user?.role || '').toLowerCase();

  /* Which menu list does this role see? */
  let nav = CLIENT_NAV;
  if (['firmadmin', 'lawyer', 'intern'].includes(role)) nav = FIRM_NAV;
  if (role === 'superadmin') nav = SUPER_NAV;

  /* Firm tier badge - fetched once for firm staff (vanilla sidebar.js did this). */
  const [tier, setTier] = useState(null);
  useEffect(() => {
    if (!['firmadmin', 'lawyer', 'intern'].includes(role) || !user?.firmId) return;
    api.users.getAllFirms(role)
      .then((firms) => {
        const firm = (firms || []).find((f) => f.id === user.firmId);
        if (firm?.tier) setTier(firm.tier);
      })
      .catch(() => {}); // badge is decorative - ignore failures
  }, [role, user?.firmId]);

  /* Highlight the link whose route matches the current URL. */
  const isActive = (to) => currentPath.startsWith(to);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand text-white transition-transform
        md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Brand row */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        {/* small bar-chart logo drawn with SVG */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="rgba(255,255,255,0.15)" />
          <path d="M7 6h2v12H7V6zm4 4h2v8h-2v-8zm4-2h2v10h-2V8z" fill="#fff" />
        </svg>
        <span className="text-lg font-bold tracking-tight">LexFlow</span>
      </div>

      {/* The links themselves */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav
          .filter((item) => !item.onlyAdmin || role === 'firmadmin') // hide admin-only links
          .filter((item) => !(role === 'intern' && item.label === 'Billing')) // interns can't see billing
          .map((item) => (
            <a
              key={item.to}
              href={`#${item.to}`}
              onClick={onClose} /* close mobile menu after tapping */
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition
                ${isActive(item.to) ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon name={item.icon} />
              {item.label}
            </a>
          ))}
      </nav>

      {/* Bottom: firm tier + who is logged in + logout */}
      <div className="space-y-3 border-t border-white/10 px-5 py-4">
        {tier && (
          <span className="inline-block rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold">
            Tier: {tier}
          </span>
        )}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <Icon name="user" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.fullName || user?.name || 'User'}</p>
            <p className="text-xs text-slate-400">{roleLabel(user?.role)}</p>
          </div>
          <button onClick={signOut} title="Logout" aria-label="Logout"
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
