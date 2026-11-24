import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { UsersModule } from '../users/users.module';
import { CasesModule } from '../cases/cases.module';

@Module({
  imports: [UsersModule, CasesModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule { }
