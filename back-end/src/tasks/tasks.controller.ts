import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { CasesService } from '../cases/cases.service';
import { TasksService } from './tasks.service';
import { Task, TaskStatus } from './task.interface';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/dto';

@Controller('tasks')
@UseGuards(RolesGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly casesService: CasesService,
  ) {}

  @Get()
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.INTERN, UserRole.SUPERADMIN)
  findAll(
    @Req() req: any,
    @Query('firmId') firmId?: string,
    @Query('caseId') caseId?: string,
    @Query('status') status?: TaskStatus,
  ): Task[] {
    const tasks = this.tasksService.findAll({ firmId, caseId, status });
    // A lawyer only gets the tasks that belong to cases assigned to them.
    if (req.user?.role === 'lawyer') {
      const myCases = new Set(
        this.casesService.findAll({ lawyerId: req.user.id }).map((c) => String(c.id)),
      );
      return tasks.filter((t) => myCases.has(String(t.caseId)));
    }
    return tasks;
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
