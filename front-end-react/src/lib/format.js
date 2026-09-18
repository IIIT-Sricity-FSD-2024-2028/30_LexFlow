/**
 * lib/format.js - Tiny formatting helpers used across many pages.
 * Keeping them in one place avoids copy-pasting the same logic.
 */

/** ₹ 1,23,456.00  - Indian currency format, same as the vanilla app. */
export function money(value, decimals = 2) {
  const n = Number(value || 0);
  return '₹' + n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** ₹ 2.1Cr / ₹ 3.4L / ₹ 5.6K - short form used by the revenue dashboard. */
export function moneyShort(value) {
  const n = Number(value || 0);
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(1) + 'Cr'; // crore
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + 'L';  // lakh
  if (n >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'K';  // thousand
  return '₹' + n.toLocaleString('en-IN');
}

/** "15 Aug 2026" - safe with bad/missing dates (returns the raw text). */
export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value; // not a real date, print as-is
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "15 Aug 2026, 14:05" - used by the activity log. */
export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** "May 12, 2026" - the calendar picker format sent to the backend. */
export function toLongDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** First letters of each word, max 2 - used for avatar circles. */
export function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** The human label for each role. */
export function roleLabel(role) {
  const map = {
    client: 'Client', firmadmin: 'Firm Admin', firmAdmin: 'Firm Admin',
    lawyer: 'Lawyer', intern: 'Intern', superadmin: 'Super Admin', superAdmin: 'Super Admin',
  };
  return map[role] || 'User';
}

/** "now" → "5m ago" style relative time for chat timestamps. */
export function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Truncate long text with an ellipsis. */
export function truncate(text, n = 30) {
  if (!text) return '';
  return text.length > n ? text.slice(0, n) + '…' : text;
}
