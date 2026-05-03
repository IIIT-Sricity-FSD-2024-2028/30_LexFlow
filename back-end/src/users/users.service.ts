import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRole } from './dto/create-user.dto';
import { SharedDataService, SharedUser } from '../common/shared-data.service';

@Injectable()
export class UsersService {
  constructor(private readonly sharedData: SharedDataService) {}

  // ── Helper ─────────────────────────────────────────────────────────────────
  private mapToResponse(user: SharedUser): UserResponseDto {
    return {
      id:           user.id,
      fullName:     user.fullName,
      email:        user.email,
      role:         user.role as unknown as UserRole,
      createdAt:    user.createdAt,
      phone:        user.phone,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city:         user.city,
      state:        user.state,
      pinCode:      user.pinCode,
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  create(dto: CreateUserDto): UserResponseDto {
    const existing = this.sharedData.findUserByEmail(dto.email);
    if (existing) throw new ConflictException('Email is already registered');

    const user: SharedUser = {
      id:           this.sharedData.nextUserId(),
      fullName:     dto.fullName,
      email:        dto.email,
      role:         dto.role as unknown as import('../common/shared-data.service').UserRole,
      password:     dto.password,
      createdAt:    new Date(),
      phone:        dto.phone,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      city:         dto.city,
      state:        dto.state,
      pinCode:      dto.pinCode,
    };

    this.sharedData.users.push(user);
    return this.mapToResponse(user);
  }

  findAll(role?: UserRole): UserResponseDto[] {
    return this.sharedData
      .findUsersByRole(role as unknown as import('../common/shared-data.service').UserRole)
      .map((u) => this.mapToResponse(u));
  }

  findOne(id: string): UserResponseDto {
    const user = this.sharedData.findUserById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.mapToResponse(user);
  }

  login(dto: LoginUserDto): UserResponseDto {
    const user = this.sharedData.findUserByEmail(dto.email);
    if (!user || user.password !== dto.password) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (dto.role && user.role !== (dto.role as unknown)) {
      throw new UnauthorizedException('Invalid email, password, or role');
    }
    return this.mapToResponse(user);
  }
}
