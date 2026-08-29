import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { CasesModule } from './cases/cases.module';
import { DocumentsModule } from './documents/documents.module';
import { BillingModule } from './billing/billing.module';
import { TasksModule } from './tasks/tasks.module';
import { LawFirmsModule } from './law-firms/law-firms.module';
import { AppLoggerService } from './common/logger/logger.service';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

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
  providers: [
    AppLoggerService,
    // ── Global error-handling middleware (exception filter) ──────────────────
    // Catches all unhandled exceptions, logs them via AppLoggerService, and
    // returns a consistent JSON error shape to API consumers.
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  // ── Router-level middleware ────────────────────────────────────────────────
  // LoggingMiddleware logs method, URL, status code, duration, and caller IP
  // for every incoming request. Security headers are handled by Helmet (main.ts).
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
