import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ActivityLogService } from './activity-log.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, ActivityLogService],
})
export class DocumentsModule {}