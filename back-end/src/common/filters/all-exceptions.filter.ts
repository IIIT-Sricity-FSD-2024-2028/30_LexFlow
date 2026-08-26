import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';
import { AppLoggerService } from '../logger/logger.service';

/**
 * Global error handling middleware (exception filter).
 *
 * Catches every unhandled exception thrown anywhere in the request
 * pipeline (controllers, services, guards, interceptors) and:
 *   1. writes the error to the rotating error log file, and
 *   2. returns the same JSON error shape NestJS produces by default,
 *      so existing API consumers are unaffected.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.normalizeException(exception);

    // ── Log the error ────────────────────────────────────────────────────────
    const logMessage =
      `${request.method} ${request.originalUrl} → ${status}` +
      ` | ${this.extractMessage(exception)}`;

    if (status >= 500) {
      this.logger.error(
        logMessage,
        exception instanceof Error ? exception.stack : '',
      );
    } else {
      this.logger.warn(logMessage);
    }

    // ── Send the response ────────────────────────────────────────────────────
    response.status(status).json(body);
  }

  /** Map any thrown value to an HTTP status code and response body. */
  private normalizeException(exception: unknown): {
    status: number;
    body: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // HttpException created with a plain string keeps Nest's default shape
      if (typeof payload === 'string') {
        return { status, body: { statusCode: status, message: payload } };
      }
      return { status, body: payload as Record<string, unknown> };
    }

    // File upload middleware (multer) failures → meaningful client errors
    if (exception instanceof MulterError) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        return {
          status: HttpStatus.PAYLOAD_TOO_LARGE,
          body: {
            statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
            message:
              'Uploaded file is too large. Maximum allowed size is 10 MB.',
            error: 'Payload Too Large',
          },
        };
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          statusCode: HttpStatus.BAD_REQUEST,
          message: `File upload error: ${exception.message}`,
          error: 'Bad Request',
        },
      };
    }

    // Unknown errors: log the details, but never leak internals to the client
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      },
    };
  }

  private extractMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') return payload;
      if (payload && typeof payload === 'object' && 'message' in payload) {
        const message = (payload as { message?: unknown }).message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.join(', ');
        return JSON.stringify(message) ?? exception.message;
      }
      return exception.message;
    }
    if (exception instanceof Error) return exception.message;
    if (typeof exception === 'string') return exception;
    return JSON.stringify(exception) ?? 'Unknown error value';
  }
}
