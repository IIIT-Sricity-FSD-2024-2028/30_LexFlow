import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../users/dto';

const VALID_ROLES: string[] = Object.values(UserRole);

/** Routes reachable without a `role` header (health check, login, Swagger). */
export const PUBLIC_PATH_PREFIXES = ['/', '/users/login', '/api/docs'];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => path === p || (p !== '/' && path.startsWith(p)));
}

/**
 * Router-level (R) + Security (S) header validation:
 *  1. Every non-public route must carry a valid `role` header.
 *  2. Role-scoped header requirements:
 *     - /billing/*            → clients need `x-user-id`, lawyers need `x-user-name`
 *     - /consultations/my     → clients need `x-client-id`
 *     - POST/PATCH /documents → `x-user-email` required (upload attribution)
 */
export function validateHeaders(req: Request): void {
  // Nest mounts route middleware per matched path, so req.path is '/'
  // here — match on the full URL instead.
  const path = req.originalUrl.split('?')[0];
  const role = (req.headers['role'] as string | undefined)?.toLowerCase();
  const public_ = isPublicPath(path);

  if (!public_ && !role) {
    throw new ForbiddenException('Role header is required');
  }
  if (!public_ && !VALID_ROLES.includes(role as string)) {
    throw new ForbiddenException(
      `Invalid role header. Valid values: ${VALID_ROLES.join(', ')}`,
    );
  }

  const header = (name: string) => {
    const v = req.headers[name];
    return typeof v === 'string' ? v.trim() : '';
  };

  if (path.startsWith('/billing') && (role === 'client' || role === 'lawyer')) {
    if (role === 'client' && !header('x-user-id')) {
      throw new BadRequestException('x-user-id header is required for client billing access');
    }
    if (role === 'lawyer' && !header('x-user-name')) {
      throw new BadRequestException('x-user-name header is required for lawyer billing access');
    }
  }

  if (path === '/consultations/my' && role === 'client' && !header('x-client-id')) {
    throw new BadRequestException('x-client-id header is required to fetch your consultations');
  }

  if (
    path.startsWith('/documents') &&
    (req.method === 'POST' || req.method === 'PATCH') &&
    path !== '/documents/activity' &&
    !header('x-user-email')
  ) {
    throw new BadRequestException('x-user-email header is required for document uploads');
  }
}
