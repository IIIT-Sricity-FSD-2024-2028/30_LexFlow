import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator';
import { q, parseActorId } from '../db';
import { ACTORS_UNION, ROLE_OF_KIND } from '../users/users.service';

// ponytail: no Passport — a Bearer parse + jwt.verify does what a
// passport-jwt strategy would; add it only if multiple strategies appear.

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

/**
 * Global guard, migration phase 1:
 *  - No Authorization header → request passes through on the legacy
 *    role/x-user-id headers (the whole static frontend still works).
 *  - Authorization: Bearer <jwt> → the token IS the identity: verified,
 *    re-resolved against Postgres (so a disabled/deleted user's old token
 *    dies immediately), and attached as req.user.
 *
 * When every page sends Bearer tokens, flipping this to reject header-only
 * requests is the one-line phase-3 change.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const header = request.headers['authorization'];
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      if (isPublic) return true;
      // Legacy-header migration window: no token, fall through to the
      // header-based identity the controllers already use.
      return true;
    }
    if (isPublic) return true; // public routes don't need the token checked

    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync(header.slice(7).trim());
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const parsed = parseActorId(payload.sub);
    if (!parsed) throw new UnauthorizedException('Invalid token subject');

    const { rows } = await q(
      `SELECT * FROM (${ACTORS_UNION}) u WHERE kind = $1 AND id = $2`,
      [parsed.kind, parsed.num],
    );
    const row = rows[0];
    if (!row || row.is_active === false) {
      throw new UnauthorizedException('User no longer exists or is disabled');
    }

    // Token identity wins over any client-supplied header.
    request.user = {
      id: payload.sub,
      email: row.email,
      role: ROLE_OF_KIND[row.kind as keyof typeof ROLE_OF_KIND],
      firmId: row.lawfirm_id ? `firm-${row.lawfirm_id}` : undefined,
    };
    return true;
  }
}
