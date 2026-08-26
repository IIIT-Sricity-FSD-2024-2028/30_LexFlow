import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppLoggerService } from '../logger/logger.service';

/**
 * HTTP request logging middleware.
 *
 * Logs one line per request — method, URL, status code, response time and
 * caller IP — to the rotating application log files via AppLoggerService.
 */
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl: url, ip } = req;
    const startTime = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const message = `${method} ${url} ${res.statusCode} ${durationMs}ms - ${ip}`;

      if (res.statusCode >= 500) {
        this.logger.error(message);
      } else if (res.statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}
