import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { CreateUserDto, LoginUserDto, UserRole, UserResponseDto } from './dto';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  password?: string;
  caseAccess?: Record<string, string[]>;
}

@Injectable()
export class UsersService {
  private users: User[] = [];
  private idCounter = 1;

  constructor() {
    this.seedIfEmpty();
  }

  /** Seed some dummy users so you don't need to recreate accounts every restart */
  private seedIfEmpty() {
    if (this.users.length > 0) return;

    const now = new Date();
    const seed: User[] = [
      {
        id: 'user-0',
        fullName: 'Super Admin',
        email: 'superadmin@lexflow.test',
        role: UserRole.SUPERADMIN,
        createdAt: now,
        password: 'superadminpass',
      },
      {
        id: 'user-1',
        fullName: 'Firm Admin',
        email: 'firmadmin@lexflow.test',
        role: UserRole.FIRMADMIN,
        createdAt: now,
        password: 'firmadminpass',
      },
      {
        id: 'user-2',
        fullName: 'Client Alice',
        email: 'alice@client.test',
        role: UserRole.CLIENT,
        createdAt: now,
        password: 'clientpass',
        phone: '+91-9000000001',
        addressLine1: '123 Client St',
        city: 'Bengaluru',
        state: 'Karnataka',
        pinCode: '560001',
        caseAccess: { 'CASE-46': ['DOC-207', 'DOC-208'] },
      },
      {
        id: 'user-3',
        fullName: 'Lawyer Bob',
        email: 'bob@lawyer.test',
        role: UserRole.LAWYER,
        createdAt: now,
        password: 'lawyerpass',
      },
      {
        id: 'user-4',
        fullName: 'Intern Charlie',
        email: 'charlie@intern.test',
        role: UserRole.INTERN,
        createdAt: now,
        password: 'internpass',
      },
    ];

    this.users = seed.slice();
    this.idCounter = seed.length + 1;
  }

  create(createUserDto: CreateUserDto): UserResponseDto {
    const existingUser = this.users.find(
      (user) => user.email.toLowerCase() === createUserDto.email.toLowerCase(),
    );

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const user: User = {
      id: `user-${this.idCounter++}`,
      fullName: createUserDto.fullName,
      email: createUserDto.email,
      role: createUserDto.role,
      createdAt: new Date(),
      password: createUserDto.password,
      phone: createUserDto.phone,
      addressLine1: createUserDto.addressLine1,
      addressLine2: createUserDto.addressLine2,
      city: createUserDto.city,
      state: createUserDto.state,
      pinCode: createUserDto.pinCode,
    };

    this.users.push(user);
    return this.mapToResponse(user);
  }

  findAll(role?: UserRole): UserResponseDto[] {
    const results = role
      ? this.users.filter((user) => user.role === role)
      : this.users;

    return results.map((user) => this.mapToResponse(user));
  }

  findOne(id: string): UserResponseDto {
    const user = this.users.find((u) => u.id === id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapToResponse(user);
  }

  login(loginUserDto: LoginUserDto): UserResponseDto {
    const user = this.users.find(
      (u) =>
        u.email.toLowerCase() === loginUserDto.email.toLowerCase() &&
        u.password === loginUserDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (loginUserDto.role && user.role !== loginUserDto.role) {
      throw new UnauthorizedException('Invalid email, password, or role');
    }

    return this.mapToResponse(user);
  }

  private mapToResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      phone: user.phone,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      state: user.state,
      pinCode: user.pinCode,
      caseAccess: user.caseAccess,
    };
  }
}
