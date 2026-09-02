import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppLoggerService } from '../logger/logger.service';
import { validateHeaders } from './header-validation.middleware';

/**
 * Logging (L) + Router-level (R) middleware: validates role/scoped headers
 * (see header-validation) and logs every inbound request — timestamp,
 * method, path, caller role and IP — to the daily application log.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    validateHeaders(req);

    const start = Date.now();

    res.on('finish', () => {
      this.logger.log(
        `${req.method} ${req.originalUrl} → ${res.statusCode}`,
        'HttpRequest',
        {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - start,
          role: (req.headers['role'] as string) ?? null,
          ip: req.ip,
        },
      );
    });

    next();
  }
}
