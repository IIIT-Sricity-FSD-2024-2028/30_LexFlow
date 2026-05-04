import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { CasesModule } from './cases/cases.module';
import { DocumentsModule } from './documents/documents.module';
import { BillingModule } from './billing/billing.module';
import { TasksModule } from './tasks/tasks.module';
import { LawFirmsModule } from './law-firms/law-firms.module';

@Module({
  imports: [
    UsersModule,
    ConsultationsModule,
    CasesModule,
    DocumentsModule,
    BillingModule,
    TasksModule,
    LawFirmsModule,
  ],
  controllers: [AppController],
  providers:   [AppService],
})
export class AppModule {}
