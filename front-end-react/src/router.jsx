/**
 * router.jsx - React Router (react-router-dom) integration & navigation bridge.
 *
 * Provides compatibility helpers for existing components while delegating routing
 * to react-router-dom (BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation).
 */

import {
  Link,
  NavLink,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';

let globalNavigate = null;

export function setGlobalNavigate(navFn) {
  globalNavigate = navFn;
}

/**
 * Programmatically navigate to a route: navigate('/client/cases').
 * Uses React Router's navigator when available, falling back to a full page load.
 */
export function navigate(path) {
  if (globalNavigate) {
    globalNavigate(path);
  } else {
    window.location.assign(path);
  }
}

/**
 * Backward-compatible hook returning the current route pathname.
 */
export function useRoute() {
  const location = useLocation();
  return location.pathname || '/';
}

/** Split "/client/cases/12" into ["client","cases","12"]. */
export function segments(path) {
  return path.split('/').filter(Boolean);
}

/** Match ":param" patterns in path (backward-compatibility helper). */
export function matchRoute(path, pattern) {
  const p = segments(path);
  const pat = segments(pattern);
  if (p.length !== pat.length) return null;
  const params = {};
  for (let i = 0; i < pat.length; i++) {
    if (pat[i].startsWith(':')) params[pat[i].slice(1)] = decodeURIComponent(p[i]);
    else if (pat[i] !== p[i]) return null;
  }
  return params;
}

export { Link, NavLink, useNavigate, useLocation, useParams, useSearchParams };
