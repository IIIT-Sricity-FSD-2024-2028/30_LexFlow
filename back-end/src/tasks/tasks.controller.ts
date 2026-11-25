import { FirmWrite } from '../common/decorators/firm-write.decorator';
import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { CasesService } from '../cases/cases.service';
import { TasksService } from './tasks.service';
import { Task, TaskStatus } from './task.interface';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/dto';
import { UsersService } from '../users/users.service';

@FirmWrite()
@Controller('tasks')
@UseGuards(RolesGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly casesService: CasesService,
    private readonly usersService: UsersService,
  ) {}

  /** Interns cannot assign tasks: the assignee must stay empty or be the intern themself. */
  private async assertInternNotAssigning(req: any, assignedUser: unknown): Promise<void> {
    const role = String(req.user?.role ?? req.headers?.['role'] ?? '').toLowerCase();
    const name = typeof assignedUser === 'string' ? assignedUser.trim().toLowerCase() : '';
    if (role !== UserRole.INTERN || !name || name === 'unassigned') return;

    const me = req.user?.id ? await this.usersService.findOne(req.user.id) : null;
    if (me?.fullName.trim().toLowerCase() !== name) {
      throw new ForbiddenException('Interns cannot assign tasks');
    }
  }

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
  async create(@Req() req: any, @Body() taskData: Partial<Task>): Promise<Task> {
    await this.assertInternNotAssigning(req, taskData.assignedUser);
    return this.tasksService.create(taskData);
  }

  @Patch(':id')
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.INTERN)
  async update(@Req() req: any, @Param('id') id: string, @Body() updateData: Partial<Task>): Promise<Task> {
    const current = this.tasksService.findOne(id);
    // Only check when the assignee changes, so an intern can still edit other fields.
    if (updateData.assignedUser !== undefined && updateData.assignedUser !== current.assignedUser) {
      await this.assertInternNotAssigning(req, updateData.assignedUser);
    }
    return this.tasksService.update(id, updateData);
  }

  @Delete(':id')
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER)
  remove(@Param('id') id: string): void {
    return this.tasksService.remove(id);
  }
}
