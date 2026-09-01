import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { CasesModule } from './cases/cases.module';
import { DocumentsModule } from './documents/documents.module';
import { BillingModule } from './billing/billing.module';
import { TasksModule } from './tasks/tasks.module';
import { LawFirmsModule } from './law-firms/law-firms.module';
import { PlatformModule } from './platform/platform.module';
import { LoggerModule } from './common/logger/logger.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

@Module({
  imports: [
    LoggerModule,
    UsersModule,
    ConsultationsModule,
    CasesModule,
    DocumentsModule,
    BillingModule,
    TasksModule,
    LawFirmsModule,
    PlatformModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes('{*splat}');
  }
}
