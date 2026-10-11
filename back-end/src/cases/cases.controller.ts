import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/dto';

@ApiTags('cases')
@Controller('cases')
@UseGuards(RolesGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) { }

  // The logged-in user comes from the JWT (set by JwtAuthGuard).
  private currentUser(req: any) {
    if (!req.user) throw new UnauthorizedException('Login required');
    return req.user;
  }

  @Post()
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER)
  @ApiOperation({ summary: 'Create a new case' })
  create(@Body() createCaseDto: CreateCaseDto) {
    return this.casesService.create(createCaseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all cases with optional filtering' })
  @ApiQuery({ name: 'firmId', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'lawyerId', required: false })
  findAll(
    @Query('firmId') firmId?: string,
    @Query('clientId') clientId?: string,
    @Query('lawyerId') lawyerId?: string,
    @Req() req?: any,
  ) {
    const user = this.currentUser(req);
    return this.casesService
      .findAll({ firmId, clientId, lawyerId })
      .filter((c) => this.casesService.canSee(user, c));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a case by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    const found = this.casesService.findOne(+id);
    if (!this.casesService.canSee(this.currentUser(req), found)) {
      throw new ForbiddenException('You do not have access to this case');
    }
    return found;
  }

  @Patch(':id')
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.INTERN)
  @ApiOperation({ summary: 'Update a case' })
  update(@Param('id') id: string, @Body() updateCaseDto: UpdateCaseDto) {
    return this.casesService.update(+id, updateCaseDto);
  }

  @Delete(':id')
  @Roles(UserRole.FIRMADMIN)
  @ApiOperation({ summary: 'Delete a case' })
  remove(@Param('id') id: string) {
    return this.casesService.remove(+id);
  }
}
