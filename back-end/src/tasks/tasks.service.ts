import { Injectable, NotFoundException } from '@nestjs/common';
import { Task, TaskPriority, TaskStatus } from './task.interface';

@Injectable()
export class TasksService {
  private tasks: Task[] = [];
  private idCounter = 4;

  constructor() {
    this.seedTasks();
  }

  private seedTasks() {
    this.tasks = [
      {
        id: 'T-001',
        name: 'Review Evidence',
        caseTitle: 'State vs John Doe',
        assignedUser: 'Lawyer Bob',
        priority: TaskPriority.HIGH,
        dueDate: '2026-05-15',
        status: TaskStatus.PENDING,
        description: 'Analyze the forensic reports for Case #1.',
        caseId: '1',
        firmId: 'firm-1',
      },
      {
        id: 'T-002',
        name: 'Draft Agreement',
        caseTitle: 'TechCorp vs SoftSystems',
        assignedUser: 'Lawyer Bob',
        priority: TaskPriority.MEDIUM,
        dueDate: '2026-06-10',
        status: TaskStatus.PENDING,
        description: 'Prepare the initial draft for the settlement agreement.',
        caseId: '3',
        firmId: 'firm-1',
      },
      {
        id: 'T-003',
        name: 'Client Briefing',
        caseTitle: 'General Task',
        assignedUser: 'Firm Admin',
        priority: TaskPriority.LOW,
        dueDate: '2026-05-05',
        status: TaskStatus.COMPLETED,
        description: 'Introductory session for the new case onboarding.',
        firmId: 'firm-1',
      },
    ];
  }

  findAll(filters: { firmId?: string; caseId?: string; status?: TaskStatus }): Task[] {
    let filtered = [...this.tasks];
    if (filters.firmId) {
      filtered = filtered.filter((t) => t.firmId === filters.firmId);
    }
    if (filters.caseId) {
      filtered = filtered.filter((t) => t.caseId === filters.caseId);
    }
    if (filters.status) {
      filtered = filtered.filter((t) => t.status === filters.status);
    }
    return filtered;
  }

  findOne(id: string): Task {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  create(taskData: Partial<Task>): Task {
    const newTask: Task = {
      id: `T-${String(this.idCounter++).padStart(3, '0')}`,
      name: taskData.name || 'Untitled Task',
      assignedUser: taskData.assignedUser || 'Unassigned',
      priority: taskData.priority || TaskPriority.LOW,
      dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
      status: taskData.status || TaskStatus.PENDING,
      ...taskData,
    } as Task;
    this.tasks.push(newTask);
    return newTask;
  }

  update(id: string, updateData: Partial<Task>): Task {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new NotFoundException(`Task ${id} not found`);
    this.tasks[idx] = { ...this.tasks[idx], ...updateData };
    return this.tasks[idx];
  }

  remove(id: string): void {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new NotFoundException(`Task ${id} not found`);
    this.tasks.splice(idx, 1);
  }
}
