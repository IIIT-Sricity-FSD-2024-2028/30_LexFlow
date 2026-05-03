import { Injectable } from '@nestjs/common';

/**
 * SharedDataService — single source of truth for all in-memory data.
 *
 * Owns the users[] array so UsersService (auth/CRUD) and BillingService
 * (client dropdown, invoice scoping) always read from the same store.
 *
 * Other modules (Cases, Consultations, Documents) can import CommonModule
 * and inject SharedDataService when their teammates are ready to integrate.
 */

export enum UserRole {
  CLIENT     = 'client',
  LAWYER     = 'lawyer',
  INTERN     = 'intern',
  FIRMADMIN  = 'firmadmin',
  SUPERADMIN = 'superadmin',
}

export interface SharedUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  password: string;
  createdAt: Date;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  firmId?: string;   // which firm this user belongs to (firmadmin's user-id)
}

@Injectable()
export class SharedDataService {
  // ── Users (owned here, used by UsersService + BillingService) ─────────────
  readonly users: SharedUser[] = [];
  private idCounter = 1;

  constructor() {
    this.seedUsers();
  }

  private seedUsers(): void {
    const now = new Date();
    const seed: SharedUser[] = [
      {
        id: 'user-0', fullName: 'Super Admin',
        email: 'superadmin@lexflow.test', role: UserRole.SUPERADMIN,
        password: 'superadminpass', createdAt: now,
      },
      {
        id: 'user-1', fullName: 'Firm Admin',
        email: 'firmadmin@lexflow.test', role: UserRole.FIRMADMIN,
        password: 'firmadminpass', createdAt: now,
        firmId: 'user-1',           // firm admin is their own firmId
      },
      {
        id: 'user-2', fullName: 'Alice',
        email: 'alice@client.test', role: UserRole.CLIENT,
        password: 'clientpass', createdAt: now,
        phone: '+91-9000000001', addressLine1: '123 Client St',
        city: 'Bengaluru', state: 'Karnataka', pinCode: '560001',
        firmId: 'user-1',           // Alice belongs to Firm Admin's firm
      },
      {
        id: 'user-3', fullName: 'Bob',
        email: 'bob@lawyer.test', role: UserRole.LAWYER,
        password: 'lawyerpass', createdAt: now,
        firmId: 'user-1',
      },
      {
        id: 'user-4', fullName: 'Charlie',
        email: 'charlie@intern.test', role: UserRole.INTERN,
        password: 'internpass', createdAt: now,
        firmId: 'user-1',
      },
    ];
    this.users.push(...seed);
    this.idCounter = seed.length + 1;
  }

  /** Generate next user id */
  nextUserId(): string {
    return `user-${this.idCounter++}`;
  }

  /** Find all users, optionally filtered by role */
  findUsersByRole(role?: UserRole): SharedUser[] {
    return role ? this.users.filter((u) => u.role === role) : [...this.users];
  }

  /** Find users belonging to a specific firm, optionally filtered by role */
  findUsersByFirm(firmId: string, role?: UserRole): SharedUser[] {
    return this.users.filter(
      (u) => u.firmId === firmId && (!role || u.role === role),
    );
  }

  /** Find a single user by id — returns undefined if not found */
  findUserById(id: string): SharedUser | undefined {
    return this.users.find((u) => u.id === id);
  }

  /** Find a single user by email — returns undefined if not found */
  findUserByEmail(email: string): SharedUser | undefined {
    return this.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
  }
}
