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
  accountStatus?: 'active' | 'inactive';
  availability?: 'available' | 'unavailable';
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
  subtitle?: string;
  description?: string;
  rating?: number;
  reviews?: number;
  price?: number;
  availability?: 'Available' | 'Busy';
  experience?: string;
  bio?: string;
  practiceArea?: string;
  location?: string;
  avatar?: string;
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
      { id: 'user-0', fullName: 'Super Admin', email: 'superadmin@lexflow.test', role: UserRole.SUPERADMIN, createdAt: now, password: 'superadminpass', accountStatus: 'active', availability: 'available' },
      { id: 'user-1', fullName: 'Rajesh Sharma', email: 'firmadmin@lexflow.test', role: UserRole.FIRMADMIN, createdAt: now, password: 'firmadminpass', firmId: 'firm-1', accountStatus: 'active', availability: 'available' },
      { id: 'user-2', fullName: 'Client Alice', email: 'alice@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', phone: '+91-9000000001', accountStatus: 'active', availability: 'available' },
      { id: 'user-200', fullName: 'Client Dave', email: 'dave@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', accountStatus: 'active', availability: 'available' },
      { id: 'user-201', fullName: 'Client Eve', email: 'eve@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', accountStatus: 'active', availability: 'available' },
      { id: 'user-202', fullName: 'Client Frank', email: 'frank@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', accountStatus: 'active', availability: 'available' },
      { id: 'user-203', fullName: 'Client Grace', email: 'grace@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', accountStatus: 'active', availability: 'available' },
      { id: 'user-204', fullName: 'Client Henry', email: 'henry@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', accountStatus: 'active', availability: 'available' },
      { id: 'user-205', fullName: 'Client Irene', email: 'irene@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', accountStatus: 'active', availability: 'available' },
      { id: 'user-206', fullName: 'Client Jake', email: 'jake@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', accountStatus: 'active', availability: 'available' },
      { id: 'user-207', fullName: 'Client Laura', email: 'laura@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', accountStatus: 'active', availability: 'available' },
      { id: 'user-208', fullName: 'Client Mark', email: 'mark@client.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', accountStatus: 'active', availability: 'available' },
      
      // Firm 1: Sharma & Associates (firm-1)
      { id: 'user-3', fullName: 'Lawyer Bob', email: 'bob@lawyer.test', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-1', accountStatus: 'active', availability: 'available' },
      { id: 'user-4', fullName: 'Lawyer Amit', email: 'amit@sharma.law', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-1', accountStatus: 'active', availability: 'available' },
      { id: 'user-11', fullName: 'Lawyer Sunita', email: 'sunita@sharma.law', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-1', accountStatus: 'active', availability: 'available' },
      { id: 'user-12', fullName: 'Intern Charlie', email: 'charlie@intern.test', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-1', accountStatus: 'active', availability: 'available' },
      { id: 'user-23', fullName: 'Intern Aman', email: 'aman@sharma.law', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-1', accountStatus: 'active', availability: 'available' },
      { id: 'user-24', fullName: 'Intern Riya', email: 'riya@sharma.law', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-1', accountStatus: 'active', availability: 'available' },

      // Firm 2: Khanna & Co (firm-2)
      { id: 'user-5', fullName: 'Ananya Khanna', email: 'ananya@khanna.law', role: UserRole.FIRMADMIN, createdAt: now, password: 'firmadminpass', firmId: 'firm-2', accountStatus: 'active', availability: 'available' },
      { id: 'user-13', fullName: 'Lawyer Rahul', email: 'rahul@khanna.law', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-2', accountStatus: 'active', availability: 'available' },
      { id: 'user-14', fullName: 'Lawyer Priya', email: 'priya@khanna.law', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-2', accountStatus: 'active', availability: 'available' },
      { id: 'user-15', fullName: 'Lawyer Vikram', email: 'vikram@khanna.law', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-2', accountStatus: 'active', availability: 'available' },
      { id: 'user-25', fullName: 'Intern Karan', email: 'karan@khanna.law', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-2', accountStatus: 'active', availability: 'available' },
      { id: 'user-26', fullName: 'Intern Ishita', email: 'ishita@khanna.law', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-2', accountStatus: 'active', availability: 'available' },
      { id: 'user-27', fullName: 'Intern Sameer', email: 'sameer@khanna.law', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-2', accountStatus: 'active', availability: 'available' },

      // Firm 3: Tech Legal Bangalore (firm-3)
      { id: 'user-6', fullName: 'Siddharth Reddy', email: 'siddharth@techlegal.test', role: UserRole.FIRMADMIN, createdAt: now, password: 'firmadminpass', firmId: 'firm-3', accountStatus: 'active', availability: 'available' },
      { id: 'user-9', fullName: 'Lawyer David', email: 'david@techlegal.test', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-3', accountStatus: 'active', availability: 'available' },
      { id: 'user-16', fullName: 'Lawyer Suman', email: 'suman@techlegal.test', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-3', accountStatus: 'active', availability: 'available' },
      { id: 'user-17', fullName: 'Lawyer Karthik', email: 'karthik@techlegal.test', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-3', accountStatus: 'active', availability: 'available' },
      { id: 'user-28', fullName: 'Intern Arjun', email: 'arjun@techlegal.test', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-3', accountStatus: 'active', availability: 'available' },
      { id: 'user-29', fullName: 'Intern Kavya', email: 'kavya@techlegal.test', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-3', accountStatus: 'active', availability: 'available' },
      { id: 'user-30', fullName: 'Intern Manish', email: 'manish@techlegal.test', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-3', accountStatus: 'active', availability: 'available' },

      // Firm 4: Coastal Legal Chennai (firm-4)
      { id: 'user-7', fullName: 'Meenakshi Iyer', email: 'meenakshi@coastal.test', role: UserRole.FIRMADMIN, createdAt: now, password: 'firmadminpass', firmId: 'firm-4', accountStatus: 'active', availability: 'available' },
      { id: 'user-10', fullName: 'Lawyer Elena', email: 'elena@coastal.test', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-4', accountStatus: 'active', availability: 'available' },
      { id: 'user-18', fullName: 'Lawyer Arjun', email: 'arjun@coastal.test', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-4', accountStatus: 'active', availability: 'available' },
      { id: 'user-19', fullName: 'Lawyer Divya', email: 'divya@coastal.test', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-4', accountStatus: 'active', availability: 'available' },
      { id: 'user-31', fullName: 'Intern Pooja', email: 'pooja@coastal.test', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-4', accountStatus: 'active', availability: 'available' },
      { id: 'user-32', fullName: 'Intern Surya', email: 'surya@coastal.test', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-4', accountStatus: 'active', availability: 'available' },
      { id: 'user-33', fullName: 'Intern Lakshmi', email: 'lakshmi@coastal.test', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-4', accountStatus: 'active', availability: 'available' },

      // Firm 5: Cyber Law Experts Hyderabad (firm-5)
      { id: 'user-8', fullName: 'Vikram Singh', email: 'vikram@cyber.test', role: UserRole.FIRMADMIN, createdAt: now, password: 'firmadminpass', firmId: 'firm-5', accountStatus: 'active', availability: 'available' },
      { id: 'user-20', fullName: 'Client Naveen', email: 'naveen@cyber.test', role: UserRole.CLIENT, createdAt: now, password: 'clientpass', firmId: 'firm-5', accountStatus: 'active', availability: 'available' },
      { id: 'user-21', fullName: 'Lawyer Sneha', email: 'sneha@cyber.test', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-5', accountStatus: 'active', availability: 'available' },
      { id: 'user-22', fullName: 'Lawyer Rohan', email: 'rohan@cyber.test', role: UserRole.LAWYER, createdAt: now, password: 'lawyerpass', firmId: 'firm-5', accountStatus: 'active', availability: 'available' },
      { id: 'user-34', fullName: 'Intern Tushar', email: 'tushar@cyber.test', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-5', accountStatus: 'active', availability: 'available' },
      { id: 'user-35', fullName: 'Intern Neha', email: 'neha@cyber.test', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-5', accountStatus: 'active', availability: 'available' },
      { id: 'user-36', fullName: 'Intern Sahil', email: 'sahil@cyber.test', role: UserRole.INTERN, createdAt: now, password: 'internpass', firmId: 'firm-5', accountStatus: 'active', availability: 'available' },
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
        subtitle: 'Civil & Corporate Litigation Specialists',
        description: 'A premier law firm in Delhi specializing in high-stakes corporate disputes and constitutional law matters.',
        rating: 4.8,
        reviews: 124,
        price: 5000,
        availability: 'Available',
        experience: '25+ Years',
        bio: 'Founded in 1998, Sharma & Associates has grown to be one of the most respected litigation firms in India.',
        practiceArea: 'corporate',
        location: 'delhi',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=SA&backgroundColor=3b5bdb',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'firm-2',
        name: 'Khanna & Co',
        email: 'info@khanna.law',
        phone: '9988776655',
        street: 'Nariman Point',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400021',
        primaryEmail: 'mumbai@khanna.law',
        website: 'https://www.khanna.law',
        subtitle: 'Intellectual Property & Technology Law',
        description: 'Specializing in patent filings, trademark disputes, and technology transfer agreements for startups and tech giants.',
        rating: 4.6,
        reviews: 89,
        price: 4500,
        availability: 'Available',
        experience: '15+ Years',
        bio: 'Khanna & Co is at the forefront of digital law in India, helping companies navigate complex IP landscapes.',
        practiceArea: 'intellectual property',
        location: 'mumbai',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=KC&backgroundColor=10b981',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'firm-3',
        name: 'Tech Legal Bangalore',
        email: 'blr@techlegal.test',
        phone: '8877665544',
        street: 'MG Road',
        city: 'Bangalore',
        state: 'Karnataka',
        pinCode: '560001',
        primaryEmail: 'info@techlegal.test',
        website: 'https://techlegal.test',
        subtitle: 'IT Law & Startup Advisory',
        description: 'Comprehensive legal solutions for the IT industry, including SaaS agreements and data privacy compliance.',
        rating: 4.7,
        reviews: 56,
        price: 4000,
        availability: 'Available',
        experience: '12+ Years',
        bio: 'Leading Bangalore firm focused on technology law and startup growth.',
        practiceArea: 'technology',
        location: 'bangalore',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=TLB&backgroundColor=6366f1',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'firm-4',
        name: 'Coastal Legal Chennai',
        email: 'chennai@coastal.test',
        phone: '7766554433',
        street: 'Marina Beach Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pinCode: '600001',
        primaryEmail: 'legal@coastal.test',
        website: 'https://coastallegal.test',
        subtitle: 'Criminal & Maritime Law',
        description: 'Defending high-profile criminal cases and representing maritime logistics companies in international waters.',
        rating: 4.5,
        reviews: 42,
        price: 3500,
        availability: 'Available',
        experience: '20+ Years',
        bio: 'Established firm with deep roots in Chennai legal history.',
        practiceArea: 'criminal',
        location: 'chennai',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=CLC&backgroundColor=f59e0b',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'firm-5',
        name: 'Cyber Law Experts Hyderabad',
        email: 'hyd@cyber.test',
        phone: '6655443322',
        street: 'Hitech City',
        city: 'Hyderabad',
        state: 'Telangana',
        pinCode: '500081',
        primaryEmail: 'experts@cyber.test',
        website: 'https://cyberlaw.test',
        subtitle: 'Cyber Security & Forensic Law',
        description: 'Specializing in cybercrime defense, data breach response, and electronic evidence management.',
        rating: 4.9,
        reviews: 31,
        price: 6000,
        availability: 'Available',
        experience: '8+ Years',
        bio: 'Modern firm at the cutting edge of digital forensic investigations.',
        practiceArea: 'cyber',
        location: 'hyderabad',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=CLE&backgroundColor=0ea5e9',
        createdAt: now,
        updatedAt: now,
      }
    ];

    this.users = seed.slice();
    this.firms = seedFirms.slice();
    this.idCounter = 23;
    this.firmIdCounter = 6;
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
      firmId: createUserDto.firmId,
      accountStatus: createUserDto.accountStatus || 'active',
      availability: createUserDto.availability || 'available',
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

  findUsersByFirm(firmId: string): UserResponseDto[] {
    const results = this.users.filter((user) => user.firmId === firmId);
    return results.map((user) => this.mapToResponse(user));
  }

  findOne(id: string): UserResponseDto {
    const user = this.users.find((u) => u.id === id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapToResponse(user);
  }

  updateUser(id: string, updateUserDto: Partial<CreateUserDto>): UserResponseDto {
    console.log(`[Backend] Updating user ${id}:`, JSON.stringify(updateUserDto, null, 2));
    const userIndex = this.users.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.email && updateUserDto.email !== this.users[userIndex].email) {
      const existingUser = this.users.find((u) => u.email.toLowerCase() === updateUserDto.email!.toLowerCase());
      if (existingUser) {
        throw new ConflictException('Email is already registered');
      }
    }

    const updatedUser = { ...this.users[userIndex], ...updateUserDto };
    this.users[userIndex] = updatedUser;

    return this.mapToResponse(updatedUser);
  }

  deleteUser(id: string): void {
    const userIndex = this.users.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      throw new NotFoundException('User not found');
    }
    const user = this.users[userIndex];
    if (user.role === UserRole.CLIENT) {
      user.firmId = undefined;
    } else {
      this.users.splice(userIndex, 1);
    }
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

    if (loginUserDto.role) {
      const isFirmPortal = loginUserDto.role === UserRole.FIRMADMIN || loginUserDto.role === UserRole.INTERN;
      const userIsFirmMember = [UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.INTERN].includes(user.role);

      if (isFirmPortal) {
        if (!userIsFirmMember) {
          throw new UnauthorizedException('Access denied: You are not a member of this firm');
        }
      } else if (user.role !== loginUserDto.role) {
        throw new UnauthorizedException('Invalid email, password, or role');
      }
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
      accountStatus: user.accountStatus,
      availability: user.availability,
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
  getAllClients(): User[] {
    return this.users.filter(u => u.role === UserRole.CLIENT);
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

  
  getUsersByFirm(firmId: string, role?: UserRole): User[] {
    return this.users.filter(user =>
      user.firmId === firmId && (!role || user.role === role)
    );
  }

  /**
   * Get lawyers belonging to a specific firm.
   * firmadmin: pass their own firmId — only gets lawyers in that firm.
   * superadmin: pass undefined — gets all lawyers across all firms.
   */
  getLawyersByFirmId(firmId?: string): UserResponseDto[] {
    let results = this.users.filter(
      (u) => 
        u.role === UserRole.LAWYER || 
        u.role === UserRole.INTERN
    );
    if (firmId) {
      results = results.filter((u) => u.firmId === firmId);
    }
    return results.map(u => this.mapToResponse(u));
  }
}

