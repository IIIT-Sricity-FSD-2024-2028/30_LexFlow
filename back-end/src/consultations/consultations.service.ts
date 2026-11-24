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
import { loadState, tx } from '../db';

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

export type ConsultationScope = Partial<Pick<Consultation, 'firmId' | 'clientId' | 'lawyerId'>>;

interface ConsultationState {
  consultations: Consultation[];
  workflowBookings: WorkflowBookingRecord[];
  nextId: number;
}

const STATE_KEY = 'consultations';

@Injectable()
export class ConsultationsService {
  private readonly initialState: ConsultationState = {
    consultations: [],
    workflowBookings: [],
    nextId: Date.now(),
  };

  constructor(private readonly usersService: UsersService) {}

  private readState() {
    return loadState(STATE_KEY, this.initialState);
  }

  private async writeState<T>(change: (state: ConsultationState) => T): Promise<T> {
    return tx(async (db) => {
      await db.query(
        'INSERT INTO app_state (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [STATE_KEY, JSON.stringify(this.initialState)],
      );
      // Read after acquiring the row lock so two servers can book concurrently.
      const { rows } = await db.query<{ data: ConsultationState }>(
        'SELECT data FROM app_state WHERE key = $1 FOR UPDATE',
        [STATE_KEY],
      );
      const state = rows[0].data;
      const result = change(state);
      await db.query('UPDATE app_state SET data = $2 WHERE key = $1', [
        STATE_KEY, JSON.stringify(state),
      ]);
      return result;
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * GET all consultations with optional filters.
   * Accessible by firmadmin / lawyer / superadmin.
   */
  async findAll(filters: ConsultationScope & {
    status?: string;
  }): Promise<ConsultationResponseDto[]> {
    let { consultations: results } = await this.readState();

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
  /**
   * GET a single consultation by ID.
   * Accessible by all roles.
   */
  async findOne(id: string, scope: ConsultationScope): Promise<ConsultationResponseDto> {
    const state = await this.readState();
    return this.toResponse(this.getConsultation(state, id, scope));
  }

  private getConsultation(state: ConsultationState, id: string, scope: ConsultationScope) {
    const consultation = state.consultations.find((c) => c.id === id &&
      (!scope.firmId || c.firmId === scope.firmId) &&
      (!scope.clientId || c.clientId === scope.clientId) &&
      (!scope.lawyerId || c.lawyerId === scope.lawyerId));
    if (!consultation) {
      throw new NotFoundException(`Consultation with ID "${id}" not found`);
    }
    return consultation;
  }

  /**
   * POST — Create a new consultation (client booking).
   */
  async create(dto: CreateConsultationDto): Promise<ConsultationResponseDto> {
    const [client, firm] = await Promise.all([
      this.usersService.findOne(dto.clientId),
      this.usersService.getFirmById(dto.firmId),
    ]);
    if (client.role !== 'client') throw new BadRequestException('Select a registered client');

    return this.writeState((state) => {
      const now = new Date();
      const consultation: Consultation = {
        ...dto,
        id: `CONS-${state.nextId++}`,
        clientId: client.id,
        clientName: client.fullName,
        firmId: firm.id,
        firmName: firm.name,
        lawyerName: dto.lawyerName || 'Awaiting Assignment',
        status: ConsultationStatus.PENDING,
        avatarClass: dto.avatarClass || 'blue',
        bookedViaWorkflow: dto.bookedViaWorkflow ?? false,
        createdAt: now,
        updatedAt: now,
      };
      state.consultations.push(consultation);
      if (consultation.bookedViaWorkflow) state.workflowBookings.push(this.toBooking(consultation));
      return this.toResponse(consultation);
    });
  }

  /**
   * PATCH — Update a consultation (firm admin assigns lawyer / changes status).
   */
  async update(id: string, dto: UpdateConsultationDto, scope: ConsultationScope): Promise<ConsultationResponseDto> {
    const updated = await this.writeState((state) => {
      const existing = this.getConsultation(state, id, scope);
      if (existing.status === ConsultationStatus.CANCELLED || existing.status === ConsultationStatus.COMPLETED) {
        throw new ForbiddenException(`Cannot update a consultation that is ${existing.status}`);
      }
      Object.assign(existing, dto, { status: dto.status ?? existing.status, updatedAt: new Date() });
      return this.toResponse(existing);
    });

    // Logic for conversion: If status is being set to CONFIRMED (Accepted),
    // convert the prospect into a client of this law firm.
    if (dto.status === ConsultationStatus.CONFIRMED) {
      try {
        // Clients are platform-global now; the consultation itself is the
        // firm link, so this is bookkeeping only.
        await this.usersService.updateUser(updated.clientId, {
          firmId: updated.firmId,
        });
      } catch (err) {
        console.warn(`[Backend] Failed to convert user ${updated.clientId} to client: ${err.message}`);
      }
    }
    return updated;
  }

  /**
   * PATCH /:id/cancel — Cancel a consultation (client or firmadmin).
   * Extracted as a named method to enforce business rules.
   */
  cancel(id: string, scope: ConsultationScope): Promise<ConsultationResponseDto> {
    return this.writeState((state) => {
      const existing = this.getConsultation(state, id, scope);
      if (existing.status === ConsultationStatus.COMPLETED) {
        throw new ForbiddenException('Cannot cancel a completed consultation');
      }
      if (existing.status === ConsultationStatus.CANCELLED) {
        throw new BadRequestException('Consultation is already cancelled');
      }
      existing.status = ConsultationStatus.CANCELLED;
      existing.updatedAt = new Date();
      return this.toResponse(existing);
    });
  }

  /**
   * DELETE — Hard delete a consultation record (firmadmin / superadmin only).
   */
  remove(id: string, scope: ConsultationScope): Promise<{ message: string }> {
    return this.writeState((state) => {
      const existing = this.getConsultation(state, id, scope);
      state.consultations.splice(state.consultations.indexOf(existing), 1);
      state.workflowBookings = state.workflowBookings.filter((wb) => wb.consultationId !== id);
      return { message: `Consultation ${id} deleted successfully` };
    });
  }

  /**
   * GET /workflow-bookings — Returns all consultations booked via the client
   * search/discovery workflow. Intended for firm admins to see organic demand.
   */
  async getWorkflowBookings(firmId?: string): Promise<WorkflowBookingRecord[]> {
    const { workflowBookings } = await this.readState();
    return workflowBookings.filter((booking) => !firmId || booking.firmId === firmId)
      .map((booking) => ({ ...booking, bookedAt: new Date(booking.bookedAt) }));
  }

  private toBooking(c: Consultation): WorkflowBookingRecord {
    return {
      consultationId: c.id,
      clientId: c.clientId,
      clientName: c.clientName,
      firmId: c.firmId,
      firmName: c.firmName,
      bookedAt: c.createdAt,
      consultationType: c.type,
      requestedDate: c.date,
      requestedTime: c.time,
    };
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
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    };
  }
}
