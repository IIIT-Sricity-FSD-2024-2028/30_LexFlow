import { Global, Module } from '@nestjs/common';
import { SharedDataService } from './shared-data.service';

/**
 * CommonModule — globally available shared infrastructure.
 *
 * @Global() means you only need to import this once in AppModule.
 * Every other module (UsersModule, BillingModule, CasesModule …)
 * can inject SharedDataService without importing CommonModule themselves.
 */
@Global()
@Module({
  providers: [SharedDataService],
  exports:   [SharedDataService],
})
export class CommonModule {}
