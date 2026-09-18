/**
 * router.jsx - A tiny hand-rolled hash router (no react-router dependency).
 *
 * How it works:
 *  - URLs look like  index.html#/client/cases  ->  window.location.hash = "#/client/cases"
 *  - useRoute() returns the current path (e.g. "/client/cases").
 *  - navigate(path) changes the hash; the 'hashchange' event re-renders the app.
 *  - <Link href="..."> renders a normal <a> so middle-click / new-tab still work.
 *
 * Why hash routing? It works from ANY static host (even file://) and needs
 * zero server configuration - perfect for a college demo.
 */

import { useEffect, useState } from 'react';

/** Read the current hash path. "" or "#" becomes "/". */
function getPath() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash === '' ? '/' : hash;
}

/** Subscribe to hash changes. Re-renders every caller when the route moves. */
export function useRoute() {
  const [path, setPath] = useState(getPath); // initial value = where we are now

  useEffect(() => {
    const onChange = () => setPath(getPath());        // update state on navigation
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange); // cleanup
  }, []);

  return path;
}

/** Programmatically go somewhere: navigate('/client/cases').
    No-op when we're already there (avoids pointless re-renders). */
export function navigate(path) {
  if (window.location.hash === `#${path}`) return;
  window.location.hash = path;
}

/** A normal-looking link that routes through the hash. */
export function Link({ href, children, ...rest }) {
  return (
    <a href={`#${href}`} {...rest}>
      {children}
    </a>
  );
}

/* ── Tiny route helpers used by App.jsx ── */

/** Split "/client/cases/12" into ["client","cases","12"]. */
export function segments(path) {
  return path.split('/').filter(Boolean);
}

/** Read "?id=5" style params from a route like "/client/cases/12". */
export function matchRoute(path, pattern) {
  // Both are split into segments; ":name" parts capture values.
  const p = segments(path);
  const pat = segments(pattern);
  if (p.length !== pat.length) return null; // lengths must match exactly
  const params = {};
  for (let i = 0; i < pat.length; i++) {
    if (pat[i].startsWith(':')) params[pat[i].slice(1)] = decodeURIComponent(p[i]);
    else if (pat[i] !== p[i]) return null; // literal parts must be equal
  }
  return params; // null means "no match"
}
