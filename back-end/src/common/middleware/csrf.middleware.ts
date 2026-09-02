import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';

const CSRF_COOKIE = 'x-csrf-token';
const CSRF_HEADER = 'x-csrf-token';
/** Cookie names that indicate an ambient-credential session is in play. */
const SESSION_COOKIES = ['lexflow.sid', 'connect.sid'];
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'lexflow-default-csrf-secret-12345',
  getSessionIdentifier: (req: Request) => {
    // Tie the CSRF token to the session ID if it exists, otherwise use a generic identifier
    for (const cookieName of SESSION_COOKIES) {
      if (req.cookies && req.cookies[cookieName]) {
        return req.cookies[cookieName];
      }
    }
    return 'anonymous';
  },
  cookieName: CSRF_COOKIE,
  cookieOptions: {
    httpOnly: false, // Must be false so JS can read it to put in the header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  },
  size: 64,
  ignoredMethods: SAFE_METHODS as any,
  getCsrfTokenFromRequest: (req: Request) => req.headers[CSRF_HEADER] as string,
});

/**
 * CSRF protection (Security middleware) — double-submit cookie pattern.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // Use req.cookies provided by cookie-parser
  const hasSession = SESSION_COOKIES.some((c) => req.cookies && req.cookies[c]);

  if (SAFE_METHODS.includes(req.method)) {
    // Generate/refresh the token on safe methods so the frontend has the cookie
    generateCsrfToken(req, res);
    return next();
  }

  if (!hasSession) {
    // Header-auth request, no CSRF surface. 
    // We still ensure the token is generated.
    generateCsrfToken(req, res);
    return next();
  }

  // Session cookie is present and method is unsafe: enforce CSRF validation
  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Invalid or missing CSRF token',
        error: 'Forbidden',
      });
    }
    next();
  });
}
