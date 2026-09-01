import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { LawFirmsService } from './law-firms.service';
import { LawFirmResponseDto } from './dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/dto';

@ApiTags('law-firms')
@ApiHeader({
  name: 'role',
  description: 'Caller role: client | superadmin',
  required: true,
  enum: UserRole,
})
@UseGuards(RolesGuard)
@Controller('law-firms')
export class LawFirmsController {
  constructor(private readonly lawFirmsService: LawFirmsService) {}

  // ── GET /law-firms ─────────────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.CLIENT, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Search / list law firms',
    description:
      'Returns all law firms. Supports optional query filters: keyword, location, practiceArea, sortBy.',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    description: 'Search across firm name, subtitle, description, bio, practice areas',
    example: 'corporate',
  })
  @ApiQuery({
    name: 'location',
    required: false,
    enum: ['mumbai', 'bangalore', 'chennai', 'remote'],
    description: 'Filter by city / location key',
  })
  @ApiQuery({
    name: 'practiceArea',
    required: false,
    enum: ['corporate', 'family', 'ip', 'criminal', 'civil', 'immigration'],
    description: 'Filter by practice area',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['rating', 'price_asc', 'reviews', 'availability'],
    description: 'Sort order. Default: highest rated first.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of law firms matching the filters',
    type: [LawFirmResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden – insufficient role' })
  async findAll(
    @Query('keyword') keyword?: string,
    @Query('location') location?: string,
    @Query('practiceArea') practiceArea?: string,
    @Query('sortBy') sortBy?: string,
  ): Promise<LawFirmResponseDto[]> {
    return await this.lawFirmsService.findAll({ keyword, location, practiceArea, sortBy });
  }

  // ── GET /law-firms/:id ─────────────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Get a single law firm profile',
    description: 'Returns the full profile of a law firm by ID.',
  })
  @ApiParam({ name: 'id', example: 'firm-001', description: 'Law firm ID' })
  @ApiResponse({
    status: 200,
    description: 'Law firm profile',
    type: LawFirmResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden – insufficient role' })
  @ApiResponse({ status: 404, description: 'Law firm not found' })
  async findOne(@Param('id') id: string): Promise<LawFirmResponseDto> {
    return await this.lawFirmsService.findOne(id);
  }
}
