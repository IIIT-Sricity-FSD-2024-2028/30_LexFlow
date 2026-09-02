import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserResponseDto } from '../users/dto';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  /**
   * Sign the authenticated identity. Deliberately minimal payload: id, email,
   * role, firmId — never password material. The prefixed id ('fa-1', 'cl-2')
   * resolves back to exactly one actor table via parseActorId.
   */
  signToken(user: UserResponseDto): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      firmId: user.firmId ?? null,
    });
  }
}
