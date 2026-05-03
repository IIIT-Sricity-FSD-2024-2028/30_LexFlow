import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, LoginUserDto, UserRole, UserResponseDto } from './dto';
import { FirmOnboardingDto } from './dto/firm-onboarding.dto';
import { FirmOnboardingResponseDto } from './dto/firm-onboarding-response.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('users')
@ApiHeader({
  name: 'role',
  description: 'User role (required for all endpoints)',
  required: true,
  enum: UserRole,
})
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description: 'Authenticate using email and password.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password',
  })
  login(@Body() loginUserDto: LoginUserDto): UserResponseDto {
    return this.usersService.login(loginUserDto);
  }

  /**
   * Create a new user
   * POST /users
   * Body: { fullName, email, role }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  // @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Creates a new user with the specified role (client, lawyer, intern, firm, firmadmin, superadmin). Only firmadmins/superadmins can create users.',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only firmadmin role can create users',
  })
  create(@Body() createUserDto: CreateUserDto): UserResponseDto {
    return this.usersService.create(createUserDto);
  }

  /**
   * Get all users, optionally filtered by role
   * GET /users
   * Query: role? (client, lawyer, intern, firm, firmadmin, superadmin)
   */
  @Get()
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieve all users or filter by role. Only firmadmins and superadmins can view all users.',
  })
  @ApiQuery({
    name: 'role',
    enum: UserRole,
    required: false,
    description: 'Filter users by role',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only firmadmin role can view all users',
  })
  findAll(@Query('role') role?: UserRole): UserResponseDto[] {
    return this.usersService.findAll(role);
  }

  /**
   * Get all registered firms
   * GET /users/firms/all
   */
  @Get('firms/all')
  @ApiOperation({
    summary: 'Get all registered law firms',
    description: 'Retrieve a list of all business entities (Firms).',
  })
  @ApiResponse({
    status: 200,
    description: 'List of firms',
  })
  getAllFirms(): any {
    return this.usersService.getAllFirms();
  }

  /**
   * Get a specific user by ID
   * GET /users/:id
   * Available to all authenticated roles
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID (all roles)',
    description: 'Retrieve a specific user by their ID. Available to all roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - role header is required',
  })
  findOne(@Param('id') id: string): UserResponseDto {
    return this.usersService.findOne(id);
  }

  /**
   * Firm Onboarding Endpoints
   * Three-step process for FIRMADMIN users to register their law firm
   */

  @Post('firm-onboarding/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start firm onboarding',
    description: 'Initialize firm onboarding session',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding session started',
    schema: { properties: { sessionId: { type: 'string' } } },
  })
  startFirmOnboarding() {
    return this.usersService.startFirmOnboarding();
  }

  @Post('firm-onboarding/step1/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Firm onboarding step 1',
    description: 'Submit firm basic information (name, address, contact)',
  })
  @ApiResponse({
    status: 200,
    description: 'Step 1 completed',
    schema: { properties: { sessionId: { type: 'string' }, step: { type: 'number' } } },
  })
  submitStep1(
    @Param('sessionId') sessionId: string,
    @Body() onboardingDto: FirmOnboardingDto,
  ) {
    return this.usersService.submitOnboardingStep1(sessionId, onboardingDto);
  }

  @Post('firm-onboarding/step2/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Firm onboarding step 2',
    description: 'Submit firm contact details (email, phone, website)',
  })
  @ApiResponse({
    status: 200,
    description: 'Step 2 completed',
    schema: { properties: { sessionId: { type: 'string' }, step: { type: 'number' } } },
  })
  submitStep2(
    @Param('sessionId') sessionId: string,
    @Body() onboardingDto: FirmOnboardingDto,
  ) {
    return this.usersService.submitOnboardingStep2(sessionId, onboardingDto);
  }

  @Post('firm-onboarding/step3/:sessionId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Firm onboarding step 3 (final)',
    description: 'Complete onboarding by setting up the firm admin account',
  })
  @ApiResponse({
    status: 201,
    description: 'Firm and admin account created successfully',
    type: FirmOnboardingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or incomplete onboarding',
  })
  submitStep3(
    @Param('sessionId') sessionId: string,
    @Body() onboardingDto: FirmOnboardingDto,
  ): FirmOnboardingResponseDto {
    return this.usersService.submitOnboardingStep3(sessionId, onboardingDto);
  }
}
