import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const LOG_DIR = path.join(__dirname, '..', '..', '..', 'logs');

/**
 * Shared console format (pretty, colored).
 */
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, context, ...meta }) => {
    const ctx = context ? `[${context as string}] ` : '';
    const metaStr = Object.keys(meta).length
      ? ` ${JSON.stringify(meta)}`
      : '';
    return `${ts as string} ${level} ${ctx}${stack ?? (message as string)}${metaStr}`;
  }),
);

/**
 * File format (single line JSON-ish, easy to grep).
 */
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    return JSON.stringify({
      timestamp: ts,
      level,
      message: stack ?? message,
      ...meta,
    });
  }),
);

function dailyRotate(
  filename: string,
  maxDays: string,
): winston.transport {
  return new winston.transports.DailyRotateFile({
    filename: path.join(LOG_DIR, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: maxDays,
  });
}

/**
 * Central logging service backed by Winston with daily file rotation.
 *
 * Log streams (each in its own daily file under back-end/logs/):
 *  - app-%DATE%.log      → normal application / request logs   (14 days)
 *  - error-%DATE%.log    → errors and exceptions               (30 days)
 *  - uploads-%DATE%.log  → file upload activity                (14 days)
 *
 * Errors are written to BOTH the error log and the app log so the app
 * log shows a complete timeline while the error log stays isolated.
 */
@Injectable()
export class AppLoggerService implements NestLoggerService {
  private readonly app: winston.Logger;
  private readonly errorLogger: winston.Logger;
  private readonly uploads: winston.Logger;

  constructor() {
    this.app = winston.createLogger({
      level: process.env.LOG_LEVEL ?? 'info',
      format: fileFormat,
      transports: [dailyRotate('app', '14d')],
    });

    this.errorLogger = winston.createLogger({
      level: 'warn',
      format: fileFormat,
      transports: [dailyRotate('error', '30d')],
    });

    this.uploads = winston.createLogger({
      level: 'info',
      format: fileFormat,
      transports: [dailyRotate('uploads', '14d')],
    });
  }

  log(message: string, context?: string, meta?: Record<string, unknown>) {
    this.app.info({ message, context, ...meta });
  }

  info(message: string, context?: string, meta?: Record<string, unknown>) {
    this.app.info({ message, context, ...meta });
  }

  warn(message: string, context?: string, meta?: Record<string, unknown>) {
    this.errorLogger.warn({ message, context, ...meta });
  }

  /** Error: written to the dedicated error log AND mirrored to the app log. */
  error(
    message: string,
    trace?: string,
    context?: string,
    meta?: Record<string, unknown>,
  ) {
    this.errorLogger.error({ message, stack: trace, context, ...meta });
    this.app.error({ message, stack: trace, context, ...meta });
  }

  debug(message: string, context?: string, meta?: Record<string, unknown>) {
    this.app.debug({ message, context, ...meta });
  }

  verbose(message: string, context?: string, meta?: Record<string, unknown>) {
    this.app.verbose({ message, context, ...meta });
  }

  /** Upload-specific stream (uploads-YYYY-MM-DD.log). */
  upload(message: string, meta?: Record<string, unknown>) {
    this.uploads.info({ message, context: 'Uploads', ...meta });
  }

  /** Console-only startup banner (not persisted to log files). */
  banner(message: string) {
    winston.createLogger({ transports: [new winston.transports.Console({ format: consoleFormat })] }).info(message);
  }
}
