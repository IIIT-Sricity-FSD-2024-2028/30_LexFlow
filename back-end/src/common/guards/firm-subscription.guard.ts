import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformService } from '../../platform/platform.service';
import { FIRM_WRITE_KEY, FirmWritePolicy } from '../decorators/firm-write.decorator';

@Injectable()
export class FirmSubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly platform: PlatformService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;

    const policy = this.reflector.getAllAndOverride<FirmWritePolicy>(FIRM_WRITE_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!policy) return true;
    const actor = request.user as { role: string; firmId?: string } | undefined;
    if (!actor) {
      if (policy === 'client-signup' && request.body?.role === 'client' && !request.body.firmId) return true;
      throw new UnauthorizedException('Sign in to make changes.');
    }

    if (actor.firmId) await this.platform.requirePaidAccess(actor.firmId);
    return true;
  }
}
