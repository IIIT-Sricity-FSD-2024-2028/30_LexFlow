import { FirmWrite } from '../common/decorators/firm-write.decorator';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards, Req, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { ConsultationScope, ConsultationsService } from './consultations.service';
import {
  CreateConsultationDto,
  UpdateConsultationDto,
  ConsultationResponseDto,
} from './dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/dto';

const ROLE_HEADER_CONFIG = {
  name: 'role',
  description:
    'Caller role: client | lawyer | firmadmin | intern | superadmin',
  required: true,
  enum: UserRole,
};

interface ConsultationRequest {
  user?: { id: string; role: UserRole; firmId?: string };
}

@ApiTags('consultations')
@ApiHeader(ROLE_HEADER_CONFIG)
@UseGuards(RolesGuard)
@FirmWrite()
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  private currentUser(req: ConsultationRequest) {
    if (!req.user) throw new UnauthorizedException('Login required');
    return req.user;
  }

  private scope(req: ConsultationRequest): ConsultationScope {
    const user = this.currentUser(req);
    if (user.role === UserRole.SUPERADMIN) return {};
    if (user.role === UserRole.CLIENT) return { clientId: user.id };
    if (!user.firmId) throw new ForbiddenException('This account must belong to a firm');
    return user.role === UserRole.LAWYER
      ? { firmId: user.firmId, lawyerId: user.id }
      : { firmId: user.firmId };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /consultations/workflow-bookings
  // Must come BEFORE /:id to avoid being matched as an id
  // ──────────────────────────────────────────────────────────────────────────
  @Get('workflow-bookings')
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Get clients who booked via the search/discovery workflow',
    description:
      'Returns bookings made through law firm search. Firm admins see bookings for their firm.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of workflow booking records',
  })
  @ApiResponse({ status: 403, description: 'Forbidden – insufficient role' })
  getWorkflowBookings(@Req() req: ConsultationRequest) {
    return this.consultationsService.getWorkflowBookings(this.scope(req).firmId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /consultations/my
  // Client-only: returns consultations belonging to the authenticated client
  // ──────────────────────────────────────────────────────────────────────────
  @Get('my')
  @Roles(UserRole.CLIENT)
  @ApiOperation({
    summary: "Get the calling client's consultations",
    description:
      'Returns all consultations for the authenticated client.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of consultations for this client',
    type: [ConsultationResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Login required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden – non-client role' })
  getMyConsultations(@Req() req: ConsultationRequest): Promise<ConsultationResponseDto[]> {
    return this.consultationsService.findAll({ clientId: this.currentUser(req).id });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /consultations
  // Firm-admin / lawyer / superadmin with optional filters
  // ──────────────────────────────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.INTERN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Get all consultations (firmadmin / lawyer / intern / superadmin)',
    description:
      'Returns all consultations. Supports optional query filters: clientId, firmId, status, lawyerId.',
  })
  @ApiQuery({ name: 'clientId', required: false, description: 'Filter by client ID' })
  @ApiQuery({ name: 'firmId', required: false, description: 'Filter by firm ID' })
  @ApiQuery({ name: 'lawyerId', required: false, description: 'Filter by assigned lawyer ID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'CONFIRMED', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'CANCELLED'],
    description: 'Filter by consultation status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of consultations',
    type: [ConsultationResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden – insufficient role' })
  findAll(
    @Req() req: ConsultationRequest,
    @Query('clientId') clientId?: string,
    @Query('firmId') firmId?: string,
    @Query('status') status?: string,
    @Query('lawyerId') lawyerId?: string,
  ): Promise<ConsultationResponseDto[]> {
    return this.consultationsService.findAll({ clientId, firmId, status, lawyerId, ...this.scope(req) });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /consultations/:id
  // All authenticated roles
  // ──────────────────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({
    summary: 'Get a consultation by ID (all roles)',
    description: 'Retrieve a single consultation record by its unique ID.',
  })
  @ApiParam({ name: 'id', example: 'CONS-882', description: 'Consultation ID' })
  @ApiResponse({
    status: 200,
    description: 'Consultation details',
    type: ConsultationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Consultation not found' })
  @ApiResponse({ status: 403, description: 'role header missing or invalid' })
  findOne(@Param('id') id: string, @Req() req: ConsultationRequest): Promise<ConsultationResponseDto> {
    return this.consultationsService.findOne(id, this.scope(req));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /consultations
  // Client or superadmin creates a new booking
  // ──────────────────────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CLIENT, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Book a new consultation (client only)',
    description:
      'Creates a new consultation request. The initial status is always PENDING, awaiting firm admin review and lawyer assignment. Only clients (and superadmin) may call this.',
  })
  @ApiResponse({
    status: 201,
    description: 'Consultation created successfully',
    type: ConsultationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error – invalid or missing fields' })
  @ApiResponse({ status: 403, description: 'Forbidden – non-client role' })
  create(@Body() dto: CreateConsultationDto, @Req() req: ConsultationRequest): Promise<ConsultationResponseDto> {
    const user = this.currentUser(req);
    return this.consultationsService.create(
      user.role === UserRole.CLIENT ? { ...dto, clientId: user.id } : dto,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /consultations/:id
  // Firmadmin or lawyer updates status / assigns lawyer
  // ──────────────────────────────────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Update a consultation (firmadmin / lawyer)',
    description:
      'Update status, assign a lawyer, reschedule, or add notes. Completed and Cancelled consultations cannot be modified.',
  })
  @ApiParam({ name: 'id', example: 'CONS-910', description: 'Consultation ID' })
  @ApiResponse({
    status: 200,
    description: 'Updated consultation',
    type: ConsultationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden – cannot modify terminal-state consultations, or insufficient role' })
  @ApiResponse({ status: 404, description: 'Consultation not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateConsultationDto,
    @Req() req: ConsultationRequest,
  ): Promise<ConsultationResponseDto> {
    return this.consultationsService.update(id, dto, this.scope(req));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /consultations/:id/cancel
  // Client or firmadmin cancels a consultation
  // ──────────────────────────────────────────────────────────────────────────
  @Patch(':id/cancel')
  @Roles(UserRole.CLIENT, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Cancel a consultation (client / firmadmin)',
    description:
      'Marks the consultation as CANCELLED. Cannot cancel an already-completed consultation.',
  })
  @ApiParam({ name: 'id', example: 'CONS-882', description: 'Consultation ID to cancel' })
  @ApiResponse({
    status: 200,
    description: 'Consultation cancelled',
    type: ConsultationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Already cancelled' })
  @ApiResponse({ status: 403, description: 'Cannot cancel completed consultation, or insufficient role' })
  @ApiResponse({ status: 404, description: 'Consultation not found' })
  cancel(@Param('id') id: string, @Req() req: ConsultationRequest): Promise<ConsultationResponseDto> {
    return this.consultationsService.cancel(id, this.scope(req));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /consultations/:id
  // Hard delete — firmadmin / superadmin only
  // ──────────────────────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Delete a consultation record (firmadmin / superadmin)',
    description:
      'Permanently removes a consultation from the system. Use with caution – this action is irreversible.',
  })
  @ApiParam({ name: 'id', example: 'CONS-156', description: 'Consultation ID to delete' })
  @ApiResponse({ status: 200, description: 'Consultation deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden – insufficient role' })
  @ApiResponse({ status: 404, description: 'Consultation not found' })
  remove(@Param('id') id: string, @Req() req: ConsultationRequest): Promise<{ message: string }> {
    return this.consultationsService.remove(id, this.scope(req));
  }
}
