import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Headers,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ActivityLogService, ActivityEntry } from './activity-log.service';
import { DocumentsService, Document } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { fileUploadOptions } from '../common/middleware/file-upload.middleware';
import { UserRole } from '../users/dto';

@ApiTags('documents')
@Controller('documents')
@UseGuards(RolesGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  // ─── Activity Log Routes ─────────────────────────────────────────────────

  @Get('activity')
  @ApiOperation({ summary: 'Get activity log, optionally filtered by caseId' })
  @ApiHeader({
    name: 'role',
    description: 'User role for RBAC',
    required: true,
  })
  @ApiQuery({ name: 'caseId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Return activity log entries.' })
  findActivity(@Query('caseId') caseId?: string): ActivityEntry[] {
    return this.activityLogService.findAll(caseId);
  }

  @Post('activity')
  @ApiOperation({ summary: 'Append a new activity entry' })
  @ApiHeader({
    name: 'role',
    description: 'User role for RBAC',
    required: true,
  })
  @ApiResponse({ status: 201, description: 'Activity entry created.' })
  createActivity(
    @Body() dto: Omit<ActivityEntry, 'id' | 'date'>,
  ): ActivityEntry {
    return this.activityLogService.create(dto);
  }

  // ─── Document Routes ─────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.CLIENT, UserRole.LAWYER, UserRole.FIRMADMIN)
  @ApiOperation({ summary: 'Create a new document' })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'role',
    description: 'User role for RBAC',
    required: true,
  })
  @ApiHeader({
    name: 'x-user-email',
    description: 'Uploader email',
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: 'The document has been successfully created.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @UseInterceptors(FileInterceptor('file', fileUploadOptions()))
  create(
    @Body() createDocumentDto: CreateDocumentDto,
    @Headers('x-user-email') email?: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Document {
    const uploaderEmail = email || 'unknown@lexflow.in';
    return this.documentsService.create(createDocumentDto, uploaderEmail, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all documents, optionally filter by caseId' })
  @ApiHeader({
    name: 'role',
    description: 'User role for RBAC',
    required: true,
  })
  @ApiQuery({ name: 'caseId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Return all matching documents.' })
  findAll(@Query('caseId') caseId?: string): Document[] {
    return this.documentsService.findAll(caseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document by id' })
  @ApiHeader({
    name: 'role',
    description: 'User role for RBAC',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Return the document.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  findOne(@Param('id') id: string): Document {
    return this.documentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.LAWYER, UserRole.FIRMADMIN, UserRole.INTERN)
  @ApiOperation({ summary: 'Update a document' })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'role',
    description: 'User role for RBAC',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'The document has been successfully updated.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  @UseInterceptors(FileInterceptor('file', fileUploadOptions()))
  update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Document {
    return this.documentsService.update(id, updateDocumentDto, file);
  }

  @Delete(':id')
  @Roles(UserRole.LAWYER, UserRole.FIRMADMIN)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiHeader({
    name: 'role',
    description: 'User role for RBAC',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'The document has been successfully deleted.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  remove(@Param('id') id: string): void {
    return this.documentsService.remove(id);
  }
}
