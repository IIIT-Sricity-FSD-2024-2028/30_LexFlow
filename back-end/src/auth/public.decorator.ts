import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as not requiring authentication. Only for genuinely public
 * endpoints (login, health, docs) — the global guard protects the rest.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
