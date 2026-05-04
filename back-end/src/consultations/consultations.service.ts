import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateConsultationDto,
  UpdateConsultationDto,
  ConsultationResponseDto,
  ConsultationStatus,
} from './dto';
import { UsersService } from '../users/users.service';

// ──────────────────────────────────────────────────────────────────────────────
// Internal data model (richer than the response DTO)
// ──────────────────────────────────────────────────────────────────────────────
interface Consultation {
  id: string;
  clientId: string;
  clientName: string;
  firmId: string;
  firmName: string;
  lawyerId?: string;
  lawyerName?: string;
  type: string;
  date: string;
  time: string;
  status: ConsultationStatus;
  caseDescription?: string;
  consultationFee?: string;
  avatarClass?: string;
  bookedViaWorkflow: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Separate record for the "booked-via-workflow" tracking requirement
export interface WorkflowBookingRecord {
  consultationId: string;
  clientId: string;
  clientName: string;
  firmId: string;
  firmName: string;
  bookedAt: Date;
  consultationType: string;
  requestedDate: string;
  requestedTime: string;
}

@Injectable()
export class ConsultationsService {
  // ── In-memory stores ──────────────────────────────────────────────────────
  private consultations: Consultation[] = [];
  private workflowBookings: WorkflowBookingRecord[] = [];
  private idCounter = 1000;

  constructor(private readonly usersService: UsersService) {
    this.seedData();
  }

  // ── Seeded data so the dashboards are populated on first start ─────────────
  private seedData(): void {
    const now = new Date();

    const seed: Consultation[] = [

      // ═══════════════════════════════════════════════════════════════
      // CLIENT SIDE — user-2 (Client Alice) — Scheduled / Active
      // ═══════════════════════════════════════════════════════════════
      {
        id: 'CONS-882',
        clientId: 'user-2',
        clientName: 'Client Alice',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'video',
        date: 'May 24, 2026',
        time: '10:30 AM - 11:00 AM',
        status: ConsultationStatus.SCHEDULED,
        caseDescription: 'Property dispute with neighbor regarding boundary fence and land encroachment.',
        consultationFee: '$250',
        avatarClass: 'blue',
        bookedViaWorkflow: false,
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-895',
        clientId: 'user-2',
        clientName: 'Client Alice',
        firmId: 'firm-2',
        firmName: 'Jenkins Family Law',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'inperson',
        date: 'May 26, 2026',
        time: '02:00 PM - 03:00 PM',
        status: ConsultationStatus.CONFIRMED,
        caseDescription: 'Family custody arrangement and child support consultation.',
        consultationFee: '$200',
        avatarClass: 'green',
        bookedViaWorkflow: false,
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-901',
        clientId: 'user-2',
        clientName: 'Client Alice',
        firmId: 'firm-4',
        firmName: 'Sharma & Partners',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'chat',
        date: 'Jun 02, 2026',
        time: '11:00 AM - 11:30 AM',
        status: ConsultationStatus.CONFIRMED,
        caseDescription: 'Employment contract review before signing new job offer.',
        consultationFee: '$180',
        avatarClass: 'indigo',
        bookedViaWorkflow: true,
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-907',
        clientId: 'user-2',
        clientName: 'Client Alice',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        type: 'video',
        date: 'Jun 10, 2026',
        time: '03:00 PM - 03:30 PM',
        status: ConsultationStatus.PENDING,
        caseDescription: 'Tenant rights dispute — landlord refusing to return security deposit.',
        consultationFee: '$250',
        avatarClass: 'orange',
        bookedViaWorkflow: false,
        createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      },

      // ═══════════════════════════════════════════════════════════════
      // CLIENT SIDE — user-2 (Client Alice) — Past Consultations
      // ═══════════════════════════════════════════════════════════════
      {
        id: 'CONS-204',
        clientId: 'user-2',
        clientName: 'Client Alice',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'video',
        date: 'Mar 14, 2026',
        time: '09:00 AM - 09:30 AM',
        status: ConsultationStatus.COMPLETED,
        caseDescription: 'Property law consultation — boundary regulations resolved.',
        consultationFee: '$250',
        avatarClass: 'orange',
        bookedViaWorkflow: false,
        notes: 'Client advised on property boundary regulations. Case closed successfully.',
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 55 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-156',
        clientId: 'user-2',
        clientName: 'Client Alice',
        firmId: 'firm-3',
        firmName: 'Rodriguez Civil Law',
        lawyerName: 'Elena Rodriguez',
        type: 'chat',
        date: 'Jan 10, 2026',
        time: '04:00 PM - 04:30 PM',
        status: ConsultationStatus.CANCELLED,
        caseDescription: 'Civil law matter — client cancelled due to scheduling conflict.',
        avatarClass: 'purple',
        bookedViaWorkflow: false,
        createdAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 118 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-143',
        clientId: 'user-2',
        clientName: 'Client Alice',
        firmId: 'firm-2',
        firmName: 'Jenkins Family Law',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'inperson',
        date: 'Feb 20, 2026',
        time: '10:00 AM - 11:00 AM',
        status: ConsultationStatus.COMPLETED,
        caseDescription: 'Initial family mediation session — divorce proceedings.',
        consultationFee: '$200',
        avatarClass: 'teal',
        bookedViaWorkflow: false,
        notes: 'Mediation session completed. Follow-up scheduled.',
        createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 80 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-118',
        clientId: 'user-2',
        clientName: 'Client Alice',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'video',
        date: 'Nov 05, 2025',
        time: '01:00 PM - 01:30 PM',
        status: ConsultationStatus.COMPLETED,
        caseDescription: 'Intellectual property — trademark registration advisory.',
        consultationFee: '$300',
        avatarClass: 'blue',
        bookedViaWorkflow: true,
        notes: 'Trademark application filed. Awaiting registry response.',
        createdAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 170 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-097',
        clientId: 'user-2',
        clientName: 'Client Alice',
        firmId: 'firm-4',
        firmName: 'Sharma & Partners',
        lawyerName: 'Lawyer Bob',
        type: 'chat',
        date: 'Oct 12, 2025',
        time: '05:00 PM - 05:30 PM',
        status: ConsultationStatus.CANCELLED,
        caseDescription: 'Consumer dispute with e-commerce vendor over defective product.',
        consultationFee: '$150',
        avatarClass: 'pink',
        bookedViaWorkflow: false,
        createdAt: new Date(now.getTime() - 210 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 208 * 24 * 60 * 60 * 1000),
      },

      // ═══════════════════════════════════════════════════════════════
      // FIRM ADMIN SIDE — firm-1 (Sharma & Associates) — PENDING Requests
      // ═══════════════════════════════════════════════════════════════
      {
        id: 'CONS-910',
        clientId: 'user-200',
        clientName: 'Client Dave',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        type: 'chat',
        date: 'May 28, 2026',
        time: '11:00 AM - 11:30 AM',
        status: ConsultationStatus.PENDING,
        caseDescription: 'Criminal defense consultation — charges being filed against client.',
        avatarClass: 'indigo',
        bookedViaWorkflow: true,
        createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-911',
        clientId: 'user-201',
        clientName: 'Client Eve',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        type: 'inperson',
        date: 'May 29, 2026',
        time: '03:00 PM - 04:00 PM',
        status: ConsultationStatus.PENDING,
        caseDescription: 'Corporate contract review needed urgently before board meeting.',
        avatarClass: 'teal',
        bookedViaWorkflow: true,
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-912',
        clientId: 'user-202',
        clientName: 'Client Frank',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        type: 'video',
        date: 'Jun 01, 2026',
        time: '09:00 AM - 09:30 AM',
        status: ConsultationStatus.PENDING,
        caseDescription: 'Startup equity and co-founder agreement drafting assistance.',
        avatarClass: 'green',
        bookedViaWorkflow: true,
        createdAt: new Date(now.getTime() - 30 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 30 * 60 * 1000),
      },
      {
        id: 'CONS-913',
        clientId: 'user-203',
        clientName: 'Client Grace',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        type: 'chat',
        date: 'Jun 03, 2026',
        time: '02:00 PM - 02:30 PM',
        status: ConsultationStatus.PENDING,
        caseDescription: 'Insurance claim denial — seeking legal opinion on recourse options.',
        avatarClass: 'purple',
        bookedViaWorkflow: false,
        createdAt: new Date(now.getTime() - 45 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 45 * 60 * 1000),
      },

      // ═══════════════════════════════════════════════════════════════
      // FIRM ADMIN SIDE — firm-1 — Active / Scheduled / In-Progress
      // ═══════════════════════════════════════════════════════════════
      {
        id: 'CONS-875',
        clientId: 'user-204',
        clientName: 'Client Henry',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'video',
        date: 'May 25, 2026',
        time: '09:00 AM - 09:30 AM',
        status: ConsultationStatus.SCHEDULED,
        caseDescription: 'Mergers & acquisitions due diligence review for mid-size tech firm.',
        consultationFee: '$350',
        avatarClass: 'blue',
        bookedViaWorkflow: false,
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-876',
        clientId: 'user-205',
        clientName: 'Client Irene',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'inperson',
        date: 'May 27, 2026',
        time: '04:00 PM - 05:00 PM',
        status: ConsultationStatus.CONFIRMED,
        caseDescription: 'Workplace harassment legal consultation and filing of FIR assistance.',
        consultationFee: '$220',
        avatarClass: 'orange',
        bookedViaWorkflow: true,
        createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-877',
        clientId: 'user-206',
        clientName: 'Client Jake',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'video',
        date: 'May 23, 2026',
        time: '11:00 AM - 12:00 PM',
        status: ConsultationStatus.IN_PROGRESS,
        caseDescription: 'Real estate transaction — reviewing commercial lease for retail shop.',
        consultationFee: '$300',
        avatarClass: 'teal',
        bookedViaWorkflow: false,
        createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-878',
        clientId: 'user-207',
        clientName: 'Client Laura',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'chat',
        date: 'May 23, 2026',
        time: '01:00 PM - 01:30 PM',
        status: ConsultationStatus.IN_PROGRESS,
        caseDescription: 'Visa application rejection — seeking immigration legal advice.',
        consultationFee: '$180',
        avatarClass: 'pink',
        bookedViaWorkflow: true,
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 30 * 60 * 1000),
      },
      {
        id: 'CONS-879',
        clientId: 'user-208',
        clientName: 'Client Mark',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'inperson',
        date: 'May 30, 2026',
        time: '10:00 AM - 11:00 AM',
        status: ConsultationStatus.SCHEDULED,
        caseDescription: 'Patent infringement claim against competitor company.',
        consultationFee: '$400',
        avatarClass: 'indigo',
        bookedViaWorkflow: false,
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      },

      // ═══════════════════════════════════════════════════════════════
      // FIRM ADMIN SIDE — firm-1 — Completed History
      // ═══════════════════════════════════════════════════════════════
      {
        id: 'CONS-800',
        clientId: 'user-5',
        clientName: 'Client Dave',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'video',
        date: 'Apr 10, 2026',
        time: '02:00 PM - 02:30 PM',
        status: ConsultationStatus.COMPLETED,
        caseDescription: 'Business registration and GST compliance advisory.',
        consultationFee: '$250',
        avatarClass: 'green',
        bookedViaWorkflow: false,
        notes: 'Client registered business successfully. All documents verified.',
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'CONS-801',
        clientId: 'user-6',
        clientName: 'Client Eve',
        firmId: 'firm-1',
        firmName: 'Sharma & Associates',
        lawyerId: 'user-3',
        lawyerName: 'Lawyer Bob',
        type: 'inperson',
        date: 'Apr 18, 2026',
        time: '10:00 AM - 11:00 AM',
        status: ConsultationStatus.COMPLETED,
        caseDescription: 'Non-disclosure agreement drafting for SaaS startup.',
        consultationFee: '$300',
        avatarClass: 'blue',
        bookedViaWorkflow: true,
        notes: 'NDA drafted and signed by both parties.',
        createdAt: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
      },
    ];

    this.consultations = seed;
    this.idCounter = 914;

    // Pre-populate workflow bookings tracking for seeded workflow consultations
    seed
      .filter((c) => c.bookedViaWorkflow)
      .forEach((c) => {
        this.workflowBookings.push({
          consultationId: c.id,
          clientId: c.clientId,
          clientName: c.clientName,
          firmId: c.firmId,
          firmName: c.firmName,
          bookedAt: c.createdAt,
          consultationType: c.type,
          requestedDate: c.date,
          requestedTime: c.time,
        });
      });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * GET all consultations with optional filters.
   * Accessible by firmadmin / lawyer / superadmin.
   */
  findAll(filters: {
    clientId?: string;
    firmId?: string;
    status?: string;
    lawyerId?: string;
  }): ConsultationResponseDto[] {
    let results = [...this.consultations];

    if (filters.clientId) {
      results = results.filter((c) => c.clientId === filters.clientId);
    }
    if (filters.firmId) {
      results = results.filter((c) => c.firmId === filters.firmId);
    }
    if (filters.status) {
      results = results.filter(
        (c) => c.status.toLowerCase() === filters.status!.toLowerCase(),
      );
    }
    if (filters.lawyerId) {
      results = results.filter((c) => c.lawyerId === filters.lawyerId);
    }

    return results.map(this.toResponse);
  }

  /**
   * GET consultations belonging to a specific client.
   * Accessible by client role (client ID read from header/query).
   */
  findByClientId(clientId: string): ConsultationResponseDto[] {
    if (!clientId) {
      throw new BadRequestException(
        'x-client-id header is required for this endpoint',
      );
    }
    return this.consultations
      .filter((c) => c.clientId === clientId)
      .map(this.toResponse);
  }

  /**
   * GET a single consultation by ID.
   * Accessible by all roles.
   */
  findOne(id: string): ConsultationResponseDto {
    const consultation = this.consultations.find((c) => c.id === id);
    if (!consultation) {
      throw new NotFoundException(`Consultation with ID "${id}" not found`);
    }
    return this.toResponse(consultation);
  }

  /**
   * POST — Create a new consultation (client booking).
   */
  create(dto: CreateConsultationDto): ConsultationResponseDto {
    const id = `CONS-${this.idCounter++}`;
    const now = new Date();

    const consultation: Consultation = {
      id,
      clientId: dto.clientId,
      clientName: dto.clientName,
      firmId: dto.firmId,
      firmName: dto.firmName,
      lawyerId: dto.lawyerId,
      lawyerName: dto.lawyerName || 'Awaiting Assignment',
      type: dto.type,
      date: dto.date,
      time: dto.time,
      status: ConsultationStatus.PENDING,
      caseDescription: dto.caseDescription,
      consultationFee: dto.consultationFee,
      avatarClass: dto.avatarClass || 'blue',
      bookedViaWorkflow: dto.bookedViaWorkflow ?? false,
      createdAt: now,
      updatedAt: now,
    };

    this.consultations.push(consultation);

    // If booked via the client search/discovery workflow, track it separately
    if (consultation.bookedViaWorkflow) {
      this.workflowBookings.push({
        consultationId: id,
        clientId: consultation.clientId,
        clientName: consultation.clientName,
        firmId: consultation.firmId,
        firmName: consultation.firmName,
        bookedAt: now,
        consultationType: consultation.type,
        requestedDate: consultation.date,
        requestedTime: consultation.time,
      });
    }

    return this.toResponse(consultation);
  }

  /**
   * PATCH — Update a consultation (firm admin assigns lawyer / changes status).
   */
  update(id: string, dto: UpdateConsultationDto): ConsultationResponseDto {
    const index = this.consultations.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new NotFoundException(`Consultation with ID "${id}" not found`);
    }

    const existing = this.consultations[index];

    // Prevent updating already-cancelled or completed consultations
    if (
      existing.status === ConsultationStatus.CANCELLED ||
      existing.status === ConsultationStatus.COMPLETED
    ) {
      throw new ForbiddenException(
        `Cannot update a consultation that is ${existing.status}`,
      );
    }

    // Logic for conversion: If status is being set to CONFIRMED (Accepted),
    // convert the prospect into a client of this law firm.
    if (dto.status === ConsultationStatus.CONFIRMED) {
      try {
        this.usersService.updateUser(existing.clientId, {
          firmId: existing.firmId,
        });
        console.log(`[Backend] User ${existing.clientId} converted to Client of Firm ${existing.firmId}`);
      } catch (err) {
        console.warn(`[Backend] Failed to convert user ${existing.clientId} to client: ${err.message}`);
      }
    }

    this.consultations[index] = {
      ...existing,
      ...dto,
      updatedAt: new Date(),
    };

    return this.toResponse(this.consultations[index]);
  }

  /**
   * PATCH /:id/cancel — Cancel a consultation (client or firmadmin).
   * Extracted as a named method to enforce business rules.
   */
  cancel(id: string): ConsultationResponseDto {
    const index = this.consultations.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new NotFoundException(`Consultation with ID "${id}" not found`);
    }

    const existing = this.consultations[index];

    if (existing.status === ConsultationStatus.COMPLETED) {
      throw new ForbiddenException('Cannot cancel a completed consultation');
    }
    if (existing.status === ConsultationStatus.CANCELLED) {
      throw new BadRequestException('Consultation is already cancelled');
    }

    this.consultations[index] = {
      ...existing,
      status: ConsultationStatus.CANCELLED,
      updatedAt: new Date(),
    };

    return this.toResponse(this.consultations[index]);
  }

  /**
   * DELETE — Hard delete a consultation record (firmadmin / superadmin only).
   */
  remove(id: string): { message: string } {
    const index = this.consultations.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new NotFoundException(`Consultation with ID "${id}" not found`);
    }

    this.consultations.splice(index, 1);
    // Also remove from workflow tracking if present
    const wbIndex = this.workflowBookings.findIndex(
      (wb) => wb.consultationId === id,
    );
    if (wbIndex !== -1) {
      this.workflowBookings.splice(wbIndex, 1);
    }

    return { message: `Consultation ${id} deleted successfully` };
  }

  /**
   * GET /workflow-bookings — Returns all consultations booked via the client
   * search/discovery workflow. Intended for firm admins to see organic demand.
   */
  getWorkflowBookings(): WorkflowBookingRecord[] {
    return [...this.workflowBookings];
  }

  // ── Mapper ────────────────────────────────────────────────────────────────
  private toResponse(c: Consultation): ConsultationResponseDto {
    return {
      id: c.id,
      clientId: c.clientId,
      clientName: c.clientName,
      firmId: c.firmId,
      firmName: c.firmName,
      lawyerId: c.lawyerId,
      lawyerName: c.lawyerName,
      type: c.type as any,
      date: c.date,
      time: c.time,
      status: c.status,
      caseDescription: c.caseDescription,
      consultationFee: c.consultationFee,
      avatarClass: c.avatarClass,
      bookedViaWorkflow: c.bookedViaWorkflow,
      notes: c.notes,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
