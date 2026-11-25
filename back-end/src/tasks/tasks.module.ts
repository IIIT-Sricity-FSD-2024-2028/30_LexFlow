import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { CasesModule } from '../cases/cases.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [CasesModule, UsersModule],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
