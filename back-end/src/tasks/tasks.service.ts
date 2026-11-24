import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { loadState, saveState } from '../db';
import { Task, TaskPriority, TaskStatus } from './task.interface';

@Injectable()
export class TasksService implements OnModuleInit {
  private tasks: Task[] = [];
  private idCounter = 1;

  // Runs once after the DB is ready: use the saved tasks if there are any.
  async onModuleInit() {
    this.tasks = await loadState('tasks', this.tasks);
    const ids = this.tasks.map((t) => Number(t.id.replace('T-', '')) || 0);
    this.idCounter = Math.max(this.idCounter, ...ids.map((n) => n + 1));
  }

  findAll(filters: { firmId?: string; caseId?: string; status?: TaskStatus }): Task[] {
    let filtered = [...this.tasks];

    if (filters.firmId) {
      filtered = filtered.filter((t) => String(t.firmId) === String(filters.firmId));
    }
    if (filters.caseId) {
      filtered = filtered.filter((t) => String(t.caseId) === String(filters.caseId));
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
      dueDate: taskData.dueDate || new Date().toLocaleDateString('en-CA'),
      status: taskData.status || TaskStatus.PENDING,
      ...taskData,
    } as Task;
    this.tasks.push(newTask);
    saveState('tasks', this.tasks);
    return newTask;
  }

  update(id: string, updateData: Partial<Task>): Task {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new NotFoundException(`Task ${id} not found`);
    this.tasks[idx] = { ...this.tasks[idx], ...updateData };
    saveState('tasks', this.tasks);
    return this.tasks[idx];
  }

  remove(id: string): void {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new NotFoundException(`Task ${id} not found`);
    this.tasks.splice(idx, 1);
    saveState('tasks', this.tasks);
  }
}
