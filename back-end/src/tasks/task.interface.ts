export enum TaskPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum TaskStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
}

export class Task {
  id!: string;
  name!: string;
  caseTitle?: string;
  assignedUser!: string;
  priority!: TaskPriority;
  dueDate!: string;
  status!: TaskStatus;
  description?: string;
  caseId?: string;
  caseCnr?: string;
  firmId?: string; // To scope by firm
}
