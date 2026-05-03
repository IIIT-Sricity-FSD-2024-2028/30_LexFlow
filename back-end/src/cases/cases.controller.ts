import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('cases')
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
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
  ) {
    return this.casesService.findAll({ firmId, clientId, lawyerId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a case by ID' })
  findOne(@Param('id') id: string) {
    return this.casesService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a case' })
  update(@Param('id') id: string, @Body() updateCaseDto: UpdateCaseDto) {
    return this.casesService.update(+id, updateCaseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a case' })
  remove(@Param('id') id: string) {
    return this.casesService.remove(+id);
  }
}
