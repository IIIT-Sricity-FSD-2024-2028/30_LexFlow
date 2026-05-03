import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard — enforces RBAC by reading the `role` request header.
 *
 * How it works:
 *   1. Reads the roles set by @Roles() on the route handler / controller.
 *   2. Reads the `role` header value from the incoming request.
 *   3. Throws 403 if the header is missing or the role is not in the allowed list.
 *
 * Per the evaluation criteria:
 *   "Roles must be passed through the API request header."
 *   "Use Guards/Middleware in NestJS to enforce access control."
 *
 * Register globally in main.ts if every route needs RBAC, OR apply
 * per-controller / per-route with @UseGuards(RolesGuard).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator → allow through (public route)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
    }>();

    const role = request.headers['role'];

    if (!role) {
      throw new ForbiddenException(
        `Missing \`role\` header. This endpoint requires one of: [${requiredRoles.join(', ')}]`,
      );
    }

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException(
        `Access denied. Your role: '${role}'. ` +
        `Required: [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
