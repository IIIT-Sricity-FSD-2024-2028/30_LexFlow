import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware.
 *
 * Sets standard HTTP security response headers on every API response and
 * removes the `X-Powered-By` fingerprint header.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    // Prevent MIME-type sniffing of responses
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent the site from being framed by other origins (clickjacking)
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Enable the browser's XSS auditor for legacy browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Restrict how much referrer information leaks to other origins
    res.setHeader('Referrer-Policy', 'same-origin');

    // Hide the underlying server technology fingerprint
    res.removeHeader('X-Powered-By');

    next();
  }
}
