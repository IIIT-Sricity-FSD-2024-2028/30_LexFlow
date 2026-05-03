import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { CasesModule } from './cases/cases.module';
import { DocumentsModule } from './documents/documents.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    CommonModule,          // ← must be first; @Global() makes SharedDataService
                           //   available to ALL modules without explicit imports
    UsersModule,
    ConsultationsModule,
    CasesModule,
    DocumentsModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers:   [AppService],
})
export class AppModule {}
