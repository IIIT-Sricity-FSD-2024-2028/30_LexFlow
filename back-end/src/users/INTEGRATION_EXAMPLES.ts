/**
 * INTEGRATION EXAMPLE: How to use UsersService in other modules
 * This file demonstrates best practices for cross-module communication
 */

import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/dto';

/**
 * Example 1: Consultations Service
 * Uses UsersService to validate consultation participants
 */
@Injectable()
export class ConsultationsServiceExample {
  constructor(private usersService: UsersService) {}

  initiateConsultation(clientId: string, lawyerId: string) {
    // Verify both users exist and have correct roles
    const client = this.usersService.findOne(clientId);
    const lawyer = this.usersService.findOne(lawyerId);

    if (!client) {
      throw new Error(`Client with ID ${clientId} not found`);
    }

    if (!lawyer) {
      throw new Error(`Lawyer with ID ${lawyerId} not found`);
    }

    if (client.role !== UserRole.CLIENT) {
      throw new Error('Provided user is not a client');
    }

    if (lawyer.role !== UserRole.LAWYER) {
      throw new Error('Provided user is not a lawyer');
    }

    // Create consultation record with validated users
    return {
      consultationId: `cons-${Date.now()}`,
      client: client.fullName,
      lawyer: lawyer.fullName,
      startedAt: new Date(),
    };
  }

  /**
   * Get all consultations for a specific user
   * Handles both clients and lawyers
   */
  getUserConsultations(userId: string) {
    const user = this.usersService.findOne(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Return different data based on user role
    switch (user.role) {
      case UserRole.CLIENT:
        // Return consultations where user is client
        return this.getClientConsultations(userId);
      case UserRole.LAWYER:
        // Return consultations where user is lawyer
        return this.getLawyerConsultations(userId);
      default:
        throw new Error(`Role ${user.role} cannot participate in consultations`);
    }
  }

  private getClientConsultations(clientId: string) {
    // Implementation: Query consultations table where clientId = ...
    return [];
  }

  private getLawyerConsultations(lawyerId: string) {
    // Implementation: Query consultations table where lawyerId = ...
    return [];
  }
}

/**
 * Example 2: Billing Service
 * Uses UsersService to fetch user email and identify lawyers
 */
@Injectable()
export class BillingServiceExample {
  constructor(private usersService: UsersService) {}

  /**
   * Generate invoice for a consultation
   * Uses user data to populate invoice details
   */
  createInvoice(consultationId: string, lawyerId: string, amount: number) {
    const lawyer = this.usersService.findOne(lawyerId);

    if (!lawyer || lawyer.role !== UserRole.LAWYER) {
      throw new Error('Invalid lawyer ID for billing');
    }

    return {
      invoiceId: `inv-${Date.now()}`,
      lawyerName: lawyer.fullName,
      lawyerEmail: lawyer.email,
      amount,
      consultationId,
      createdAt: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
  }

  /**
   * Get billing address for a user
   * Useful for payment processing
   */
  getUserBillingInfo(userId: string) {
    const user = this.usersService.findOne(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // In future, extend this with address fields when role-specific DTOs are used
    return {
      userId: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
    };
  }
}

/**
 * Example 3: Case Management Service
 * Uses UsersService to assign cases to lawyers and manage case participants
 */
@Injectable()
export class CaseManagementServiceExample {
  constructor(private usersService: UsersService) {}

  /**
   * Assign a case to a lawyer
   */
  assignCaseToLawyer(caseId: string, lawyerId: string) {
    const lawyer = this.usersService.findOne(lawyerId);

    if (!lawyer) {
      throw new Error(`Lawyer ${lawyerId} not found`);
    }

    if (lawyer.role !== UserRole.LAWYER) {
      throw new Error(`User ${lawyerId} is not a lawyer`);
    }

    // Update case assignment
    return {
      caseId,
      assignedTo: lawyer.fullName,
      assignedDate: new Date(),
    };
  }

  /**
   * Get all lawyers available for case assignment
   */
  getAvailableLawyers() {
    return this.usersService.findAll(UserRole.LAWYER);
  }

  /**
   * Get all interns in a firm (when filtering by additional criteria is added)
   */
  getFirmInterns(firmId?: string) {
    const interns = this.usersService.findAll(UserRole.INTERN);

    // In future, when role-specific data is stored, filter by firmId
    // For now, return all interns
    return interns;
  }
}

/**
 * Example 4: Authentication & Authorization
 * Uses UsersService to check user roles and permissions
 */
@Injectable()
export class AuthorizationServiceExample {
  constructor(private usersService: UsersService) {}

  /**
   * Check if user can access lawyer analytics
   * Only lawyers should access their own stats
   */
  canAccessLawyerAnalytics(
    userId: string,
    targetLawyerId: string,
  ): boolean {
    const user = this.usersService.findOne(userId);
    const targetUser = this.usersService.findOne(targetLawyerId);

    if (!user || !targetUser) {
      return false;
    }

    // Lawyer can only view own analytics
    if (user.role === UserRole.LAWYER) {
      return userId === targetLawyerId;
    }

    // Firm admin can view all
    if (user.role === UserRole.FIRMADMIN) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can create documents in a case
   */
  canCreateCaseDocuments(userId: string, caseId: string): boolean {
    const user = this.usersService.findOne(userId);

    if (!user) {
      return false;
    }

    // Lawyers and admins can create documents
    return (
      user.role === UserRole.LAWYER || user.role === UserRole.FIRMADMIN
    );
  }
}

/**
 * Example 5: Module Registration (UsersModule + other modules)
 *
 * app.module.ts
 */
export const AppModuleExample = {
  imports: [
    // Import UsersModule first so others can depend on it
    'UsersModule',
    // Other modules depend on Users
    'ConsultationsModule', // imports UsersModule
    'BillingModule', // imports UsersModule
    'CaseManagementModule', // imports UsersModule
    'DocumentsModule', // imports UsersModule
  ],
};

/**
 * Example 6: HTTP Client Usage
 * If you need to integrate with external services
 */
export class ExternalServiceIntegrationExample {
  /**
   * Send email notification about new consultation
   */
  notifyConsultationParticipants(
    client: { fullName: string; email: string },
    lawyer: { fullName: string; email: string },
  ) {
    // Send to client
    console.log(
      `Sending consultation request to ${client.email}: ${client.fullName}`,
    );

    // Send to lawyer
    console.log(
      `Sending consultation invite to ${lawyer.email}: ${lawyer.fullName}`,
    );

    // In production, use HttpClientModule or axios to send actual emails
  }

  /**
   * Sync user data with external analytics service
   */
  syncUserToAnalytics(userId: string, usersService: UsersService) {
    const user = usersService.findOne(userId);

    if (user) {
      console.log(`Syncing user ${user.fullName} (${user.role}) to analytics`);
      // POST to external service: { id, email, role, createdAt }
    }
  }
}

/**
 * Summary: Integration Points
 *
 * 1. CONSULTATIONS
 *    - Validate that participants are correct roles (client + lawyer)
 *    - Fetch user names/emails for notifications
 *
 * 2. BILLING
 *    - Get lawyer email for invoices
 *    - Identify user role to calculate billing rules
 *    - Future: Access lawyer stats (winRate, totalCases)
 *
 * 3. CASE MANAGEMENT
 *    - Assign cases to lawyers (validate role)
 *    - Get available lawyers/interns list
 *    - Future: Filter by specialization, availability
 *
 * 4. DOCUMENTS
 *    - Check permissions based on user role
 *    - Associate documents with users
 *
 * 5. NOTIFICATIONS
 *    - Fetch user email/phone for alerts
 *    - Send role-specific notifications
 *
 * Key Principle: UsersService is a dependency, not a database
 * Always validate before using user data in business logic
 */
