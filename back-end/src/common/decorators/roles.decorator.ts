import { SetMetadata } from '@nestjs/common';
<<<<<<< HEAD

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
=======
import { UserRole } from '../../users/dto';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
>>>>>>> c7f6668c4bc78d81a2b303bffbd9ec3ad87d2939
