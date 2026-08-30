import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

/** File Upload (F) middleware configuration for document endpoints. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function documentUploadOptions(): MulterOptions {
  return {
    storage: diskStorage({
      destination: join(__dirname, '..', '..', '..', 'data', 'docs'),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${file.originalname.replace(ext, '')}-${uniqueSuffix}${ext}`);
      },
    }),
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
    },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return cb(null, true);
      }
      // Rejected with this message; AllExceptionsFilter maps it to a 415.
      cb(new Error(`File type not accepted: ${file.mimetype}`), false);
    },
  };
}
