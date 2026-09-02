import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AppLoggerService } from '../logger/logger.service';

const DOCS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'docs');

/**
 * Security (S) + Logging (L) + Error Handling (E) for the static
 * document store served at /data/docs/*:
 *  - Rejects path-traversal (`..`, encoded or not).
 *  - Logs every file access (file, role, IP); requests without a `role`
 *    header are still served because the frontend downloads documents via
 *    plain <a href> links that cannot attach headers — they are logged as
 *    anonymous instead of blocked, so existing downloads keep working.
 *  - Returns a structured 404 JSON instead of the Express default HTML.
 */
export function staticFilesMiddleware(logger: AppLoggerService) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const requested = decodeURIComponent(req.path);

    if (requested.includes('..')) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Invalid file path',
        error: 'Bad Request',
      });
    }

    const role = (req.headers['role'] as string) ?? 'anonymous';

    const filePath = path.join(DOCS_DIR, requested);
    if (!filePath.startsWith(DOCS_DIR) || !fs.existsSync(filePath)) {
      logger.warn(`Static file not found: ${requested}`, 'StaticFiles', {
        role,
        ip: req.ip,
      });
      return res.status(404).json({
        statusCode: 404,
        message: 'File not found',
        error: 'Not Found',
      });
    }

    logger.log(`File served: ${requested}`, 'StaticFiles', {
      file: requested,
      role,
      ip: req.ip,
    });

    next();
  };
}
