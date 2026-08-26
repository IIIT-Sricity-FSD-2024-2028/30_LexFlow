import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import DailyRotateFile = require('winston-daily-rotate-file');
import * as path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// ── Log line format: [timestamp] LEVEL: message ─────────────────────────────
const logFormat = printf((info) => {
  const { level, message, timestamp, stack } = info as {
    level: string;
    message: unknown;
    timestamp: string;
    stack?: string;
  };
  const text =
    stack || (typeof message === 'string' ? message : JSON.stringify(message));
  return `[${timestamp}] ${level}: ${text}`;
});

/**
 * Application logger backed by winston.
 *
 * Writes to the console and to files in `back-end/logs/` that rotate at
 * regular intervals (daily, and additionally whenever a file exceeds
 * maxSize). Kept files are pruned after maxFiles:
 *
 *   lexflow-YYYY-MM-DD.log        → all application/request logs
 *   lexflow-error-YYYY-MM-DD.log  → error-level entries only
 */
@Injectable()
export class AppLoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    const logsDir = path.join(__dirname, '..', '..', '..', 'logs');

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL ?? 'info',
      format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat,
      ),
      transports: [
        new winston.transports.Console({
          format: combine(colorize(), logFormat),
        }),
        new DailyRotateFile({
          dirname: logsDir,
          filename: 'lexflow-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
        }),
        new DailyRotateFile({
          dirname: logsDir,
          filename: 'lexflow-error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
        }),
      ],
    });
  }

  log(message: string, ...meta: unknown[]) {
    this.logger.info(message, ...meta);
  }

  info(message: string, ...meta: unknown[]) {
    this.logger.info(message, ...meta);
  }

  warn(message: string, ...meta: unknown[]) {
    this.logger.warn(message, ...meta);
  }

  error(message: string, ...meta: unknown[]) {
    this.logger.error(message, ...meta);
  }

  debug(message: string, ...meta: unknown[]) {
    this.logger.debug(message, ...meta);
  }

  verbose(message: string, ...meta: unknown[]) {
    this.logger.verbose(message, ...meta);
  }
}
