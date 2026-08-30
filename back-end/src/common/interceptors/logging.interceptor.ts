import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AppLoggerService } from '../logger/logger.service';

/**
 * Logging (L) interceptor: runs on every successful request/response cycle
 * and records method, URL, status and latency to the daily application log.
 * (Failures are logged by the AllExceptionsFilter instead.)
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();
    const { method, originalUrl } = req;

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.logger.log(`${method} ${originalUrl} → ${res.statusCode}`, 'LoggingInterceptor', {
            method,
            path: originalUrl,
            status: res.statusCode,
            durationMs: Date.now() - start,
            role: req.headers['role'] ?? null,
          });
        },
      }),
    );
  }
}
