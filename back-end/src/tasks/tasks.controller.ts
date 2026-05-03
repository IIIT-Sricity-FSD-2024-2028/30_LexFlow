import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Task, TaskStatus } from './task.interface';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/dto';

@Controller('tasks')
@UseGuards(RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.INTERN, UserRole.SUPERADMIN)
  findAll(
    @Query('firmId') firmId?: string,
    @Query('caseId') caseId?: string,
    @Query('status') status?: TaskStatus,
  ): Task[] {
    return this.tasksService.findAll({ firmId, caseId, status });
  }

  @Get(':id')
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.INTERN, UserRole.SUPERADMIN, UserRole.CLIENT)
  findOne(@Param('id') id: string): Task {
    return this.tasksService.findOne(id);
  }

  @Post()
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.INTERN)
  create(@Body() taskData: Partial<Task>): Task {
    return this.tasksService.create(taskData);
  }

  @Patch(':id')
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.INTERN)
  update(@Param('id') id: string, @Body() updateData: Partial<Task>): Task {
    return this.tasksService.update(id, updateData);
  }

  @Delete(':id')
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER)
  remove(@Param('id') id: string): void {
    return this.tasksService.remove(id);
  }
}
