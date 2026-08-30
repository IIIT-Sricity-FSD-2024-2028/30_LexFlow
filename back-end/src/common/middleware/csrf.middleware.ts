import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

const CSRF_COOKIE = 'x-csrf-token';
const CSRF_HEADER = 'x-csrf-token';
/** Cookie names that indicate an ambient-credential session is in play. */
const SESSION_COOKIES = ['lexflow.sid', 'connect.sid'];
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * CSRF protection (Security middleware) — double-submit cookie pattern.
 *
 * Why this cannot break the existing frontend (the earlier "invalid csrf
 * token" problem): LexFlow authenticates via custom headers (`role`,
 * `x-user-id`, ...), which a cross-origin attacker cannot attach without a
 * CORS preflight. CSRF is therefore only a risk once cookie-based sessions
 * exist. Enforcement is applied exactly then:
 *
 *  - Safe methods (GET/HEAD/OPTIONS) are always allowed; on every response
 *    a token cookie `x-csrf-token` (JS-readable) is issued/refreshed.
 *  - Unsafe methods (POST/PUT/PATCH/DELETE):
 *      · no session cookie present → allowed (header-auth request, no CSRF surface)
 *      · session cookie present    → `x-csrf-token` header must equal the cookie
 *
 * When the frontend later adopts cookie sessions it just reads the cookie
 * and echoes it in the `x-csrf-token` header — no server change needed.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!readCookie(req, CSRF_COOKIE)) {
    res.cookie(CSRF_COOKIE, crypto.randomBytes(24).toString('hex'), {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    });
  }

  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  const hasSession = SESSION_COOKIES.some((c) => readCookie(req, c) !== undefined);
  if (!hasSession) {
    return next();
  }

  const cookieToken = readCookie(req, CSRF_COOKIE);
  const headerToken = req.headers[CSRF_HEADER];
  const valid =
    !!cookieToken &&
    typeof headerToken === 'string' &&
    cookieToken.length === headerToken.length &&
    crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));

  if (!valid) {
    res.status(403).json({
      statusCode: 403,
      message: 'Invalid or missing CSRF token',
      error: 'Forbidden',
    });
    return;
  }
  next();
}
