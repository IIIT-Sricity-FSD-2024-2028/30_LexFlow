import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Attach allowed roles to a route or controller.
 *
 * Usage:
 *   @Roles('FIRM_MANAGER', 'SUPER_ADMIN')
 *   @UseGuards(RolesGuard)
 *
 * The role value is read from the `role` request header by RolesGuard.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
