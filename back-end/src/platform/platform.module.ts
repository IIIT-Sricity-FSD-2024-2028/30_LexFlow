import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';

/**
 * Platform Module
 *
 * The platform owner's own business layer: firm subscriptions, the commission
 * taken on client invoices, and the earnings reporting built on top of both.
 */
@Module({
  imports: [UsersModule, BillingModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
