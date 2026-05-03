import { Injectable, NotFoundException, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateUserDto, LoginUserDto, UserRole, UserResponseDto } from './dto';
import { FirmOnboardingDto } from './dto/firm-onboarding.dto';
import { FirmOnboardingResponseDto } from './dto/firm-onboarding-response.dto';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  phone?: string;
  password?: string;
  firmId?: string;
}

interface Firm {
  id: string;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  logo?: string;
  primaryEmail?: string;
  website?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FirmOnboardingSession {
  data?: FirmOnboardingDto;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  private users: User[] = [];
  private firms: Firm[] = [];
  private onboardingSessions: Map<string, FirmOnboardingSession> = new Map();
  private idCounter = 1;
  private firmIdCounter = 1;

  constructor() {
    this.seedIfEmpty();
  }

  /** Seed some dummy users so you don't need to recreate accounts every restart */
  private seedIfEmpty() {
    if (this.users.length > 0) return;

    const now = new Date();
    const seed: User[] = [
      { id: 'user-0', fullName: 'Super Admin', email: 'superadmin@lexflow.test', role: UserRole.SUPERADMIN, createdAt: now, password: 'superadminpass' },
      { id: 'user-1', fullName: 'Firm Admin', email: 'firmadmin@lexflow.test', role: UserRole.FIRMADMIN, createdAt: now, password: 'firmadminpass', firmId: 'firm-1' },
      { id: 'user-2', fullName: 'Client Alice', email: 'alice@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', phone: '+91-9000000001' },
      { id: 'user-3', fullName: 'Lawyer Bob', email: 'bob@lawyer.test', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass' },
      { id: 'user-4', fullName: 'Intern Charlie', email: 'charlie@intern.test', role: UserRole.INTERN, createdAt: now, password: 'internpass' },
    ];

    const seedFirms: Firm[] = [
      {
        id: 'firm-1',
        name: 'Sharma & Associates',
        email: 'contact@sharma.law',
        phone: '9876543210',
        street: '21, Connaught Place',
        city: 'New Delhi',
        state: 'Delhi',
        pinCode: '110001',
        primaryEmail: 'hello@sharma.law',
        website: 'https://www.sharma.law',
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.users = seed.slice();
    this.firms = seedFirms.slice();
    this.idCounter = 5;
    this.firmIdCounter = 2;
  }

  create(createUserDto: CreateUserDto): UserResponseDto {
    // FIRMADMIN users can only be created through onboarding flow
    if (createUserDto.role === UserRole.FIRMADMIN) {
      throw new BadRequestException('FIRMADMIN users must be created through firm onboarding');
    }

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
      firmId: user.firmId,
    };
  }

  // Firm Onboarding Methods

  /**
   * Start firm onboarding session
   */
  startFirmOnboarding(): { sessionId: string } {
    const sessionId = `session-${Date.now()}`;
    this.onboardingSessions.set(sessionId, {
      createdAt: new Date(),
    });

    return { sessionId };
  }

  /**
   * Submit Step 1: Firm basic information
   */
  submitOnboardingStep1(
    sessionId: string,
    onboardingDto: FirmOnboardingDto,
  ): { sessionId: string; step: number } {
    const session = this.onboardingSessions.get(sessionId);
    if (!session) {
      throw new BadRequestException('Invalid session ID');
    }

    // Validate required Step 1 fields
    if (!onboardingDto.fullName || !onboardingDto.email || !onboardingDto.phone || 
        !onboardingDto.street || !onboardingDto.city || !onboardingDto.state || !onboardingDto.pinCode) {
      throw new BadRequestException('All Step 1 fields are required');
    }

    session.data = { ...session.data, ...onboardingDto };
    this.onboardingSessions.set(sessionId, session);

    return { sessionId, step: 1 };
  }

  /**
   * Submit Step 2: Firm contact information
   */
  submitOnboardingStep2(
    sessionId: string,
    onboardingDto: FirmOnboardingDto,
  ): { sessionId: string; step: number } {
    const session = this.onboardingSessions.get(sessionId);
    if (!session) {
      throw new BadRequestException('Invalid session ID');
    }

    // Validate Step 1 completion
    if (!session.data?.fullName || !session.data?.email) {
      throw new BadRequestException('Please complete Step 1 first');
    }

    // Validate required Step 2 fields
    if (!onboardingDto.primaryEmail || !onboardingDto.phone) {
      throw new BadRequestException('Primary email and phone are required for Step 2');
    }

    session.data = { ...session.data, ...onboardingDto };
    this.onboardingSessions.set(sessionId, session);

    return { sessionId, step: 2 };
  }

  /**
   * Submit Step 3: Admin setup and complete firm onboarding
   */
  submitOnboardingStep3(
    sessionId: string,
    onboardingDto: FirmOnboardingDto,
  ): FirmOnboardingResponseDto {
    const session = this.onboardingSessions.get(sessionId);
    if (!session) {
      throw new BadRequestException('Invalid session ID');
    }

    // Validate Steps 1 & 2 completion
    if (!session.data?.fullName || !session.data?.email || !session.data?.primaryEmail) {
      throw new BadRequestException('Please complete Steps 1 and 2 first');
    }

    // Validate required Step 3 fields
    if (!onboardingDto.adminName || !onboardingDto.adminEmail || 
        !onboardingDto.password || !onboardingDto.confirmPassword) {
      throw new BadRequestException('All admin setup fields are required');
    }

    // Validate password confirmation
    if (onboardingDto.password !== onboardingDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if admin email already exists
    const existingUser = this.users.find(
      (u) => u.email.toLowerCase() === onboardingDto.adminEmail!.toLowerCase(),
    );
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const data = session.data;

    // Create the Firm
    const firm: Firm = {
      id: `firm-${this.firmIdCounter++}`,
      name: data.fullName!,
      email: data.email!,
      phone: data.phone!,
      street: data.street!,
      city: data.city!,
      state: data.state!,
      pinCode: data.pinCode!,
      logo: data.logo,
      primaryEmail: data.primaryEmail,
      website: data.website,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.firms.push(firm);

    // Create the FirmAdmin User with firmId reference
    const firmAdminUser: User = {
      id: `user-${this.idCounter++}`,
      fullName: onboardingDto.adminName!,
      email: onboardingDto.adminEmail!,
      role: UserRole.FIRMADMIN,
      createdAt: new Date(),
      password: onboardingDto.password,
      firmId: firm.id,
    };
    this.users.push(firmAdminUser);

    // Clean up the session
    this.onboardingSessions.delete(sessionId);

    return {
      firmId: firm.id,
      name: firm.name,
      primaryEmail: firm.primaryEmail || firm.email,
      adminUserId: firmAdminUser.id,
      adminEmail: firmAdminUser.email,
      message: 'Firm and admin account created successfully',
      createdAt: new Date(),
    };
  }

  /**
   * Get firm details by ID
   */
  getFirmById(firmId: string): Firm {
    const firm = this.firms.find((f) => f.id === firmId);
    if (!firm) {
      throw new NotFoundException('Firm not found');
    }
    return firm;
  }

  /**
   * Get all firms
   */
  getAllFirms(): Firm[] {
    return this.firms;
  }

  /**
   * Get firm for a user
   */
  getUserFirm(userId: string): Firm | null {
    const user = this.users.find((u) => u.id === userId);
    if (!user || !user.firmId) {
      return null;
    }
    return this.getFirmById(user.firmId);
  }
}
