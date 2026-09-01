import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, LoginUserDto, UserRole, UserResponseDto, UpdateUserDto, CreateFirmDto, UpdateFirmDto } from './dto';
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

  /**
   * Get all users for a specific firm
   * GET /users/by-firm/:firmId
   */
  @Get('firm/:firmId')
  @ApiOperation({
    summary: 'Get users by firm',
    description: 'Retrieve all users belonging to a specific firm',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users for the firm',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Firm not found or has no users',
  })
  getUsersByFirm(@Param('firmId') firmId: string): UserResponseDto[] {
    return this.usersService.findUsersByFirm(firmId);
  }

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
   * Superadmin: create a law firm directly
   * POST /users/firms
   */
  @Post('firms')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a law firm (superadmin only)',
    description:
      'Adds a law firm to the platform without the 3-step self-service onboarding flow. ' +
      'If adminName, adminEmail and adminPassword are all supplied, the firm admin account ' +
      'is provisioned and linked to the new firm in the same call. ' +
      'A subscription on the chosen tier starts billing immediately.',
  })
  @ApiResponse({ status: 201, description: 'Firm created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 409, description: 'Firm email or admin email already in use' })
  createFirm(@Body() dto: CreateFirmDto): any {
    return this.usersService.createFirm(dto);
  }

  /**
   * Superadmin: update a law firm
   * PUT /users/firms/:firmId
   */
  @Put('firms/:firmId')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a law firm (superadmin only)',
    description: 'Patch any editable field on a law firm, including its pricing tier.',
  })
  @ApiParam({ name: 'firmId', example: 'firm-1', description: 'Law firm ID' })
  @ApiResponse({ status: 200, description: 'Firm updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Firm not found' })
  updateFirm(
    @Param('firmId') firmId: string,
    @Body() dto: UpdateFirmDto,
  ): any {
    return this.usersService.updateFirm(firmId, dto);
  }

  /**
   * Superadmin: delete a law firm
   * DELETE /users/firms/:firmId
   */
  @Delete('firms/:firmId')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a law firm (superadmin only)',
    description:
      'Removes a law firm from the platform. A firm that still has members is rejected ' +
      'so its users are never orphaned — pass cascade=true to delete those members too.',
  })
  @ApiParam({ name: 'firmId', example: 'firm-1', description: 'Law firm ID' })
  @ApiQuery({
    name: 'cascade',
    required: false,
    description: 'Set to "true" to also delete every user belonging to this firm',
  })
  @ApiResponse({ status: 200, description: 'Firm deleted successfully' })
  @ApiResponse({ status: 400, description: 'Firm still has members and cascade was not set' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Firm not found' })
  deleteFirm(
    @Param('firmId') firmId: string,
    @Query('cascade') cascade?: string,
  ): any {
    return this.usersService.deleteFirm(firmId, cascade === 'true');
  }

  /**
   * Superadmin: change the pricing tier of a law firm
   * PUT /users/firms/:firmId/tier
   */
  @Put('firms/:firmId/tier')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a firm tier (superadmin only)',
    description: 'Change the pricing tier (Starter, Growth, Enterprise) of any law firm at any time.',
  })
  @ApiParam({ name: 'firmId', example: 'firm-1', description: 'Law firm ID' })
  @ApiResponse({
    status: 200,
    description: 'Tier updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid tier value' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Firm not found' })
  updateFirmTier(
    @Param('firmId') firmId: string,
    @Body() body: { tier: 'Starter' | 'Growth' | 'Enterprise' },
  ): any {
    return this.usersService.updateFirmTier(firmId, body.tier);
  }


  /**
   * Get lawyers filtered by firm.
   * GET /users/lawyers
   * firmadmin: pass x-firm-id header → only returns lawyers in that firm.
   * superadmin: no header needed → returns all lawyers.
   */
  @Get('lawyers')
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Get lawyers for a firm (firmadmin / superadmin)',
    description:
      'Returns all lawyers belonging to the given firm. firmadmin must pass their firmId via x-firm-id header — only lawyers with a matching firmId are returned. superadmin can omit the header to get all lawyers.',
  })
  @ApiHeader({
    name: 'x-firm-id',
    description: 'The firm ID of the calling firm admin (e.g. "firm-1"). Omit to get all (superadmin only).',
    required: false,
  })
  @ApiQuery({
    name: 'firmId',
    required: false,
    description: 'Alternative: pass firmId as query param instead of header',
  })
  @ApiResponse({
    status: 200,
    description: 'List of lawyers in the specified firm',
    type: [UserResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden – insufficient role' })
  getLawyers(
    @Query('firmId') firmId?: string,
  ): UserResponseDto[] {
    return this.usersService.getLawyersByFirmId(firmId);
  }

  /**
   * Get a specific user by ID
   * GET /users/:id
   * Available to all authenticated roles
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID (all roles)',
    description:
      'Retrieve a specific user by their ID. Available to all roles.',
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
   * Update a user
   * PUT /users/:id
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update a user',
    description: 'Update user details like role, status, and availability',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or email already registered',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): UserResponseDto {
    return this.usersService.updateUser(id, updateUserDto);
  }

  /**
   * Delete a user
   * DELETE /users/:id
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Remove a user from the system',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
  })
  deleteUser(@Param('id') id: string) {
    this.usersService.deleteUser(id);
    return { message: 'User deleted successfully' };
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
