import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RolesGuard } from '../common/guards/roles.guard';

/**
 * Users Module
 *
 * Simplified DTO structure for current academic evaluation phase.
 * Advanced role-specific DTOs are archived and available for future use.
 *
 * Exports:
 * - UsersService: Can be imported by other modules
 * - UsersController: Automatically registered with routes
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService], // Allow other modules to inject UsersService
})
export class UsersModule {}
