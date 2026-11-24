import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UsersService } from '../users/users.service';
import { CasesService } from '../cases/cases.service';
import { UserRole } from '../users/dto/create-user.dto';
import type { PoolClient } from 'pg';
import { pool, q, tx, parseActorId } from '../db';

// ── Exported types (referenced by billing.controller.ts) ─────────────────────
export interface InvoiceRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  firmId?: string;
  caseId?: number;
  caseName: string;
  advocateName: string;
  amount: number;
  status: 'Pending' | 'Paid' | 'Overdue';
  dueDate: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  clientId: string;
  clientName: string;
  firmId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  status: 'Completed';
}

export interface ClientEntry {
  id: string;
  fullName: string;
  email: string;
}

export interface InvoiceCaseEntry {
  id: number;
  clientId: string;
  name: string;
  cnr: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateInvoiceNumber(): string {
  return `INV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

/** DB stores Unpaid/Paid; the API contract exposes Pending/Overdue derived from due_date. */
function toApiStatus(dbStatus: string, dueDate: string | null): InvoiceRecord['status'] {
  if ((dbStatus || '').toLowerCase() === 'paid') return 'Paid';
  const due = dueDate ? new Date(dueDate) : null;
  if (due && !isNaN(due.getTime()) && due < new Date()) return 'Overdue';
  return 'Pending';
}

function toDbStatus(status: string | undefined): 'Paid' | 'Unpaid' {
  return (status || '').toLowerCase().trim() === 'paid' ? 'Paid' : 'Unpaid';
}

// The API-visible invoice id IS invoice_number; parse it back to the row.
function invoiceNumberToId(id: string): string {
  const num = String(id || '').replace(/^INV-/i, '');
  if (!num) throw new NotFoundException(`Invoice "${id}" not found`);
  return `INV-${num.toUpperCase()}`;
}

const INVOICE_SELECT = `
  SELECT i.invoice_number, i.total_amount, i.status, i.due_date, i.issued_at,
         i.case_name, i.app_case_id, i.advocate_name, i.lawfirm_id,
         c.id AS client_id, c.name AS client_name, c.email_address AS client_email
  FROM invoices i
  JOIN clients c ON c.id = i.client_id`;

function rowToInvoice(r: Record<string, unknown>): InvoiceRecord {
  return {
    id: r.invoice_number as string,
    clientId: `cl-${r.client_id}`,
    clientName: r.client_name as string,
    clientEmail: (r.client_email as string) || '',
    firmId: r.lawfirm_id != null ? `firm-${r.lawfirm_id}` : undefined,
    caseId: (r.app_case_id as number | null) ?? undefined,
    caseName: (r.case_name as string) || '',
    advocateName: (r.advocate_name as string) || 'Awaiting Assignment',
    amount: Number(r.total_amount),
    status: toApiStatus(r.status as string, r.due_date as string | null),
    dueDate: (r.due_date as string) || '',
    createdAt: new Date(r.issued_at as Date).toISOString(),
  };
}

@Injectable()
export class BillingService {
  constructor(
    private readonly usersService: UsersService,
    private readonly casesService: CasesService,
  ) {}

  getInvoiceCases(firmId?: string): InvoiceCaseEntry[] {
    if (!firmId) return [];
    return this.casesService.findAll({ firmId }).flatMap((record) => {
      if (!record.client_id) return [];
      return [{
        id: record.id,
        clientId: record.client_id,
        name: (record.brief_description?.trim() || record.case_type?.trim() || `Case ${record.id}`).slice(0, 255),
        cnr: record.cnr,
      }];
    });
  }

  private resolveInvoiceCase(
    firmId: string | undefined,
    clientId: string,
    { caseId, caseName }: Pick<CreateInvoiceDto, 'caseId' | 'caseName'>,
  ): InvoiceCaseEntry {
    const cases = this.getInvoiceCases(firmId).filter((entry) => entry.clientId === clientId);
    if (caseId != null) {
      const selected = cases.find((entry) => entry.id === caseId);
      if (selected) return selected;
    } else if (caseName?.trim()) {
      const name = caseName.trim().toLowerCase();
      const matches = cases.filter((entry) => entry.name.toLowerCase() === name);
      if (matches.length === 1) return matches[0];
    }
    throw new BadRequestException('Select an existing case for this client in your firm.');
  }

  // ── Client dropdown ───────────────────────────────────────────────────────
  async getClients(callerId: string): Promise<ClientEntry[]> {
    const caller = await this.usersService.findOne(callerId);

    // SUPERADMIN → all clients across all firms
    if (caller.role === UserRole.SUPERADMIN) {
      const { rows } = await q(
        `SELECT id, name, email_address FROM clients WHERE is_active ORDER BY id`,
      );
      return rows.map((c) => ({
        id: `cl-${c.id}`,
        fullName: c.name,
        email: c.email_address || '',
      }));
    }

    // FIRMADMIN / LAWYER → clients of their firm (via consultations or cases)
    const firm = await this.usersService.getUserFirm(callerId);
    if (!firm) return [];

    const fid = Number(firm.id.replace('firm-', ''));
    const caseClientIds = this.casesService.getFirmClientIds(firm.id);
    const { rows } = await q(
      `SELECT c.id, c.name, c.email_address FROM clients c WHERE c.is_active AND c.id IN (
         SELECT client_id FROM consultations WHERE lawfirm_id = $1
         UNION
         SELECT cc.client_id FROM case_clients cc
           JOIN cases cs ON cs.id = cc.case_id WHERE cs.lawfirm_id = $1
         UNION
         SELECT unnest($2::int[]))
       ORDER BY c.id`,
      [fid, caseClientIds],
    );
    return rows.map((c) => ({
      id: `cl-${c.id}`,
      fullName: c.name,
      email: c.email_address || '',
    }));
  }

  // ── Resolve a client by ID ─────────────────────────────────────────────────
  private async resolveClient(clientId: string, db: Pick<PoolClient, 'query'> = pool): Promise<ClientEntry> {
    const parsed = parseActorId(clientId);
    if (!parsed || parsed.kind !== 'cl') {
      throw new NotFoundException(
        `Client "${clientId}" not found. Ensure the user exists and has role=client.`,
      );
    }
    const { rows } = await db.query(
      `SELECT id, name, email_address FROM clients WHERE id = $1`,
      [parsed.num],
    );
    if (!rows.length) {
      throw new NotFoundException(
        `Client "${clientId}" not found. Ensure the user exists and has role=client.`,
      );
    }
    return { id: `cl-${rows[0].id}`, fullName: rows[0].name, email: rows[0].email_address || '' };
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  async createInvoice(dto: CreateInvoiceDto, firmId?: string): Promise<InvoiceRecord> {
    if (!firmId) throw new BadRequestException('The caller must belong to an invoicing firm.');
    const client = await this.resolveClient(dto.clientId);
    const invoiceCase = this.resolveInvoiceCase(firmId, client.id, dto);
    const firmNum = Number(firmId.replace('firm-', ''));
    const dbStatus = toDbStatus(dto.status);
    const number = await tx(async (c) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await c.query<{ invoice_number: string }>(
          `INSERT INTO invoices (lawfirm_id, client_id, invoice_number, total_amount, status,
                                 due_date, case_name, advocate_name, app_case_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (invoice_number) DO NOTHING RETURNING invoice_number`,
          [firmNum, Number(client.id.replace('cl-', '')), generateInvoiceNumber(),
           dto.amount, dbStatus, dto.dueDate || null, invoiceCase.name,
           dto.advocateName || 'Awaiting Assignment', invoiceCase.id],
        );
        if (res.rows.length) return res.rows[0].invoice_number;
      }
      throw new Error('Could not generate a unique invoice number');
    });

    return this.findOneInvoice(number);
  }

  async findAllInvoices(role: string, callerId?: string, callerName?: string): Promise<InvoiceRecord[]> {
    const r = (role || '').toUpperCase().trim();
    const base = `${INVOICE_SELECT}`;

    if (r === 'CLIENT' && callerId) {
      const parsed = parseActorId(callerId);
      if (!parsed || parsed.kind !== 'cl') return [];
      const { rows } = await q(`${base} WHERE i.client_id = $1 ORDER BY i.issued_at DESC`, [parsed.num]);
      return rows.map(rowToInvoice);
    }

    if (r === 'LAWYER' && callerName) {
      const { rows } = await q(
        `${base} WHERE lower(i.advocate_name) = lower($1) ORDER BY i.issued_at DESC`,
        [callerName.trim()],
      );
      return rows.map(rowToInvoice);
    }

    if (r === 'FIRMADMIN' && callerId) {
      const firm = await this.usersService.getUserFirm(callerId);
      if (!firm) return [];
      const fid = Number(firm.id.replace('firm-', ''));
      const { rows } = await q(`${base} WHERE i.lawfirm_id = $1 ORDER BY i.issued_at DESC`, [fid]);
      return rows.map(rowToInvoice);
    }

    // SUPERADMIN → all invoices
    const { rows } = await q(`${base} ORDER BY i.issued_at DESC`);
    return rows.map(rowToInvoice);
  }

  async findOneInvoice(
    id: string,
    db: Pick<PoolClient, 'query'> = pool,
    lock = false,
  ): Promise<InvoiceRecord> {
    const rowLock = lock ? 'FOR UPDATE OF i' : '';
    const { rows } = await db.query(`${INVOICE_SELECT} WHERE i.invoice_number = $1 ${rowLock}`, [invoiceNumberToId(id)]);
    if (!rows.length) throw new NotFoundException(`Invoice ${id} not found`);
    return rowToInvoice(rows[0]);
  }

  async updateInvoice(
    id: string,
    dto: UpdateInvoiceDto,
    actor: { role: string; firmId?: string },
  ): Promise<InvoiceRecord> {
    return tx(async (db) => {
      const existing = await this.findOneInvoice(id, db, true);
      if (actor.role !== UserRole.SUPERADMIN && (!actor.firmId || actor.firmId !== existing.firmId)) {
        throw new ForbiddenException('You can only edit invoices for your own firm.');
      }

      const client = dto.clientId && dto.clientId !== existing.clientId
        ? await this.resolveClient(dto.clientId, db)
        : null;
      const clientIdNum = client ? Number(client.id.replace('cl-', '')) : null;
      const changingCase = dto.caseId != null || (dto.caseName != null && dto.caseName !== existing.caseName);
      const invoiceCase = client || changingCase
        ? this.resolveInvoiceCase(existing.firmId, client?.id ?? existing.clientId, dto)
        : null;

      const status = toDbStatus(dto.status ?? existing.status);
      const dueDate = dto.dueDate ?? existing.dueDate ?? null;

      await db.query(
        `UPDATE invoices SET
           client_id   = COALESCE($2, client_id),
           case_name   = COALESCE($3, case_name),
           advocate_name = COALESCE($4, advocate_name),
           total_amount = COALESCE($5, total_amount),
           due_date    = $6,
           status      = $7,
           app_case_id = COALESCE($8, app_case_id)
         WHERE invoice_number = $1`,
        [invoiceNumberToId(id), clientIdNum, invoiceCase?.name ?? null, dto.advocateName ?? null,
         dto.amount ?? null, dueDate || null, status, invoiceCase?.id ?? null],
      );

      return this.findOneInvoice(id, db);
    });
  }

  async removeInvoice(id: string): Promise<{ message: string }> {
    const res = await q(`DELETE FROM invoices WHERE invoice_number = $1`, [invoiceNumberToId(id)]);
    if (!res.rowCount) throw new NotFoundException(`Invoice ${id} not found`);
    return { message: `Invoice ${id} deleted successfully` };
  }

  async getSummary(role: string, callerId?: string, callerName?: string) {
    const scoped = await this.findAllInvoices(role, callerId, callerName);
    let totalBilled = 0, totalPaid = 0, pendingAmount = 0,
      overdueAmount = 0, paidCount = 0, overdueCount = 0;
    scoped.forEach((inv) => {
      totalBilled += inv.amount;
      if (inv.status === 'Paid') { totalPaid += inv.amount; paidCount++; }
      else if (inv.status === 'Pending') { pendingAmount += inv.amount; }
      else if (inv.status === 'Overdue') { overdueAmount += inv.amount; overdueCount++; }
    });
    return { totalBilled, totalPaid, pendingAmount, overdueAmount, paidCount, overdueCount };
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  async findAllPayments(role: string, callerId?: string): Promise<PaymentRecord[]> {
    const r = (role || '').toUpperCase().trim();
    const base = `
      SELECT p.id, p.amount, p.method, p.paid_on,
             i.invoice_number, i.lawfirm_id,
             c.id AS client_id, c.name AS client_name
      FROM invoice_payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN clients c ON c.id = i.client_id`;

    if (r === 'CLIENT' && callerId) {
      const parsed = parseActorId(callerId);
      if (!parsed || parsed.kind !== 'cl') return [];
      const { rows } = await q(`${base} WHERE i.client_id = $1 ORDER BY p.paid_on DESC`, [parsed.num]);
      return rows.map(rowToPayment);
    }

    if (r === 'FIRMADMIN' && callerId) {
      const firm = await this.usersService.getUserFirm(callerId);
      if (!firm) return [];
      const fid = Number(firm.id.replace('firm-', ''));
      const { rows } = await q(`${base} WHERE i.lawfirm_id = $1 ORDER BY p.paid_on DESC`, [fid]);
      return rows.map(rowToPayment);
    }

    // SUPERADMIN / LAWYER → all payments
    const { rows } = await q(`${base} ORDER BY p.paid_on DESC`);
    return rows.map(rowToPayment);
  }

  async findPaymentsByInvoice(invoiceId: string): Promise<PaymentRecord[]> {
    const { rows } = await q(
      `SELECT p.id, p.amount, p.method, p.paid_on,
              i.invoice_number, i.lawfirm_id,
              c.id AS client_id, c.name AS client_name
       FROM invoice_payments p
       JOIN invoices i ON i.id = p.invoice_id
       JOIN clients c ON c.id = i.client_id
       WHERE i.invoice_number = $1 ORDER BY p.paid_on DESC`,
      [invoiceNumberToId(invoiceId)],
    );
    return rows.map(rowToPayment);
  }

  async recordPayment(invoiceId: string, paymentMethod: string): Promise<PaymentRecord> {
    const inv = await this.findOneInvoice(invoiceId);
    const num = invoiceNumberToId(invoiceId);

    const record = await tx(async (c) => {
      // One payment per invoice: a second record updates the first in place.
      const existing = await c.query(
        `SELECT id FROM invoice_payments WHERE invoice_id = (SELECT id FROM invoices WHERE invoice_number = $1)`,
        [num],
      );
      let payId: number;
      if (existing.rowCount) {
        payId = existing.rows[0].id;
        await c.query(
          `UPDATE invoice_payments SET amount = $2, method = $3, paid_on = CURRENT_DATE WHERE id = $1`,
          [payId, inv.amount, paymentMethod || 'Credit Card'],
        );
      } else {
        const inserted = await c.query(
          `INSERT INTO invoice_payments (invoice_id, amount, method)
           VALUES ((SELECT id FROM invoices WHERE invoice_number = $1), $2, $3) RETURNING id`,
          [num, inv.amount, paymentMethod || 'Credit Card'],
        );
        payId = inserted.rows[0].id;
      }
      await c.query(`UPDATE invoices SET status = 'Paid' WHERE invoice_number = $1`, [num]);
      return payId;
    });

    return {
      id: `pay-${record}`,
      invoiceId: inv.id,
      clientId: inv.clientId,
      clientName: inv.clientName,
      firmId: inv.firmId,
      amount: inv.amount,
      paymentDate: new Date().toLocaleDateString('en-CA'),
      paymentMethod: paymentMethod || 'Credit Card',
      status: 'Completed',
    };
  }
}

function rowToPayment(r: Record<string, unknown>): PaymentRecord {
  return {
    id: `pay-${r.id}`,
    invoiceId: r.invoice_number as string,
    clientId: `cl-${r.client_id}`,
    clientName: r.client_name as string,
    firmId: r.lawfirm_id != null ? `firm-${r.lawfirm_id}` : undefined,
    amount: Number(r.amount),
    paymentDate: new Date(r.paid_on as Date).toLocaleDateString('en-CA'),
    paymentMethod: (r.method as string) || 'Credit Card',
    status: 'Completed',
  };
}
