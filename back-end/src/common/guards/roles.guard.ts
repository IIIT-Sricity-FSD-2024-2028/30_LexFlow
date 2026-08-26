import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/dto';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true; // No roles required, allow access
    }

    const request = context.switchToHttp().getRequest();
    const rawRole = request.headers['role'];
    const userRole =
      typeof rawRole === 'string' ? rawRole.toLowerCase() : undefined;

    if (!userRole) {
      throw new ForbiddenException('Role header is required');
    }

    // Superadmin has access to all endpoints
    if (userRole === 'superadmin') {
      return true;
    }

    if (!requiredRoles.includes(userRole as UserRole)) {
      throw new ForbiddenException(
        `This endpoint requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
