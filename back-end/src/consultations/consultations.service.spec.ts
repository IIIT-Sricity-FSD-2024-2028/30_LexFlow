import { NotFoundException } from '@nestjs/common';
import { loadState, tx } from '../db';
import { UsersService } from '../users/users.service';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';
import { ConsultationStatus, ConsultationType } from './dto';
import { UserRole } from '../users/dto';

jest.mock('../db', () => ({ loadState: jest.fn(), tx: jest.fn() }));

describe('Shared consultation bookings', () => {
  const users = {
    findOne: jest.fn().mockResolvedValue({ id: 'cl-20', fullName: 'Test Client', role: UserRole.CLIENT }),
    getFirmById: jest.fn().mockResolvedValue({ id: 'firm-3', name: 'Tech Legal Bangalore' }),
    updateUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as UsersService;
  const client = { user: { id: 'cl-20', role: UserRole.CLIENT } };
  const firmAdmin = { user: { id: 'fa-3', role: UserRole.FIRMADMIN, firmId: 'firm-3' } };
  const otherAdmin = { user: { id: 'fa-2', role: UserRole.FIRMADMIN, firmId: 'firm-2' } };

  beforeEach(() => {
    jest.clearAllMocks();
    let saved: string | undefined;
    jest.mocked(loadState).mockImplementation(async (_key, fallback) =>
      saved ? JSON.parse(saved) : fallback,
    );
    jest.mocked(tx).mockImplementation(async (work) => {
      let pending = saved;
      const query = jest.fn(async (sql: string, [, data]: [string, string?]) => {
        if (sql.startsWith('INSERT')) pending ??= data;
        if (sql.startsWith('SELECT')) return { rows: [{ data: JSON.parse(pending!) }] };
        if (sql.startsWith('UPDATE')) pending = data;
      });
      const result = await work({ query } as unknown as Parameters<typeof work>[0]);
      saved = pending;
      return result;
    });
  });

  it('shares new and updated bookings across separate service instances', async () => {
    const clientApi = new ConsultationsController(new ConsultationsService(users));
    const firmApi = new ConsultationsController(new ConsultationsService(users));

    const booking = await clientApi.create({
      clientId: 'cl-99', clientName: 'Browser-supplied name', firmId: 'firm-3', firmName: 'Tech Legal Bangalore',
      type: ConsultationType.CHAT, date: '2026-12-01', time: '10:00 AM - 11:00 AM',
      bookedViaWorkflow: true,
    }, client);
    expect(users.findOne).toHaveBeenCalledWith('cl-20');
    expect(booking).toMatchObject({ clientId: 'cl-20', firmId: 'firm-3', status: ConsultationStatus.PENDING });
    expect(await firmApi.findAll(firmAdmin)).toContainEqual(booking);
    expect(await firmApi.findAll(otherAdmin, undefined, 'firm-3')).not.toContainEqual(booking);
    await expect(firmApi.findOne(booking.id, otherAdmin)).rejects.toBeInstanceOf(NotFoundException);

    await firmApi.update(booking.id, { status: ConsultationStatus.CONFIRMED, lawyerId: 'lw-3' }, firmAdmin);
    expect(await clientApi.getMyConsultations(client)).toContainEqual(expect.objectContaining({
      id: booking.id, status: ConsultationStatus.CONFIRMED, lawyerId: 'lw-3',
    }));
    expect(await firmApi.getWorkflowBookings(firmAdmin)).toContainEqual(expect.objectContaining({
      consultationId: booking.id, bookedAt: booking.createdAt,
    }));
  });
});
