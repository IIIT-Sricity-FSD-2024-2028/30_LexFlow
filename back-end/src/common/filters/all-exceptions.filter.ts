import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logger/logger.service';

interface MulterErrorLike {
  code?: string;
  message: string;
  name: string;
}

/** Maps raw Multer errors onto clean HTTP exceptions. */
function normalizeException(exception: unknown): HttpException {
  const err = exception as MulterErrorLike;

  if (exception instanceof HttpException) return exception;

  if (err?.name === 'MulterError' || err?.code?.startsWith('LIMIT_')) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new PayloadTooLargeException('File too large — maximum allowed size is 10 MB');
    }
    return new BadRequestException(`File upload error: ${err.message}`);
  }

  if (typeof err?.message === 'string' && /not accepted|invalid file type/i.test(err.message)) {
    return new UnsupportedMediaTypeException(
      'Invalid file type — allowed: PDF, JPG, PNG, DOCX',
    );
  }

  return new HttpException(
    'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

/**
 * Error Handling (E): global exception filter.
 *  - Writes every failure to the daily error log (method, path, status,
 *    stack, role, ip) — 5xx also carries the stack trace.
 *  - Always returns a structured JSON error to the client; never leaks
 *    internal stack traces for unexpected errors.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const httpException = normalizeException(exception);
    const status = httpException.getStatus();
    const response = httpException.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : ((response as Record<string, unknown>).message ?? httpException.message);

    const isServerError = status >= 500;
    const stack =
      exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      `${req.method} ${req.originalUrl} → ${status}: ${
        Array.isArray(message) ? message.join('; ') : String(message)
      }`,
      isServerError ? stack : undefined,
      'AllExceptionsFilter',
      {
        method: req.method,
        path: req.originalUrl,
        status,
        role: (req.headers['role'] as string) ?? null,
        ip: req.ip,
      },
    );

    res.status(status).json({
      statusCode: status,
      message,
      error: httpException.name,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }
}
