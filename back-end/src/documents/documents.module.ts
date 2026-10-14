import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ActivityLogService } from './activity-log.service';
import { CasesModule } from '../cases/cases.module';

@Module({
  imports: [CasesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, ActivityLogService],
})
export class DocumentsModule {}