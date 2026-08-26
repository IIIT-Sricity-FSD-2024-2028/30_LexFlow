import { UnsupportedMediaTypeException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

/** Directory where uploaded case documents are stored. */
export const UPLOAD_DIR = join(__dirname, '..', '..', '..', 'data', 'docs');

/** Maximum accepted upload size: 10 MB (largest existing upload is ~4 MB). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** File extensions accepted for case documents. */
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png|gif|webp|docx?|xlsx?|txt|md)$/i;

/**
 * File upload middleware configuration (multer).
 *
 * Shared by every endpoint that accepts multipart file uploads. Configures
 * disk storage with unique filenames, enforces a per-file size limit and
 * rejects file types outside the allowed whitelist.
 */
export function fileUploadOptions(): MulterOptions {
  return {
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${file.originalname.replace(ext, '')}-${uniqueSuffix}${ext}`);
      },
    }),
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_EXTENSIONS.test(extname(file.originalname))) {
        return cb(null, true);
      }
      return cb(
        new UnsupportedMediaTypeException(
          `File type "${extname(file.originalname)}" is not allowed. Allowed types: PDF, images, Office documents, text`,
        ),
        false,
      );
    },
  };
}
