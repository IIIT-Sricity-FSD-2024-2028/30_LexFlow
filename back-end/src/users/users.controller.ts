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
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Creates a new user with the specified role (client, lawyer, intern, firmadmin, superadmin). Only firmadmins/superadmins can create users.',
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
    * Query: role? (client, lawyer, intern, firmadmin, superadmin)
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
}
