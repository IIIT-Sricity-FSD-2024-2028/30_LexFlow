import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { SharedDataService } from '../common/shared-data.service';

// ── Exported types (used by billing.controller.ts) ────────────────────────────
export interface InvoiceRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

function deriveStatus(
  status: string | undefined,
  dueDate: string,
): 'Pending' | 'Paid' | 'Overdue' {
  if ((status || '').toLowerCase().trim() === 'paid') return 'Paid';
  const due = new Date(dueDate);
  if (!isNaN(due.getTime()) && due < new Date()) return 'Overdue';
  return 'Pending';
}

@Injectable()
export class BillingService {
  private invoices: InvoiceRecord[] = [];
  private payments: PaymentRecord[] = [];

  constructor(private readonly sharedData: SharedDataService) {}

  // ── Client dropdown ───────────────────────────────────────────────────────
  /**
   * Returns clients visible to the caller:
   *  - FIRM_MANAGER / LAWYER → only clients with the same firmId as the caller
   *  - SUPER_ADMIN           → all clients across all firms
   */
  getClients(callerRole: string, callerId: string): ClientEntry[] {
    const role = (callerRole || '').toUpperCase().trim();
    let users;

    if (role === 'SUPER_ADMIN' || role === 'SUPERADMIN') {
      users = this.sharedData.findUsersByRole('client' as any);
    } else {
      // Resolve caller's firmId from SharedDataService
      const caller = this.sharedData.findUserById(callerId);
      const firmId = caller?.firmId ?? callerId;
      users = this.sharedData.findUsersByFirm(firmId, 'client' as any);
    }

    return users.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email }));
  }

  // ── Helper: resolve a client from shared store ────────────────────────────
  private resolveClient(clientId: string): ClientEntry {
    const user = this.sharedData.findUserById(clientId);
    if (!user || user.role !== ('client' as any)) {
      throw new NotFoundException(
        `Client "${clientId}" not found or user is not a client.`,
      );
    }
    return { id: user.id, fullName: user.fullName, email: user.email };
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  createInvoice(dto: CreateInvoiceDto): InvoiceRecord {
    const client = this.resolveClient(dto.clientId);
    const invoice: InvoiceRecord = {
      id:           generateId('INV'),
      clientId:     client.id,
      clientName:   client.fullName,
      clientEmail:  client.email,
      caseName:     dto.caseName,
      advocateName: dto.advocateName || 'Awaiting Assignment',
      amount:       dto.amount,
      status:       deriveStatus(dto.status, dto.dueDate),
      dueDate:      dto.dueDate,
      createdAt:    new Date().toISOString(),
    };
    this.invoices.unshift(invoice);
    return invoice;
  }

  findAllInvoices(
    role: string,
    callerId?: string,
    callerName?: string,
  ): InvoiceRecord[] {
    const r = (role || '').toUpperCase().trim();
    if (r === 'CLIENT' && callerId) {
      return this.invoices.filter((inv) => inv.clientId === callerId);
    }
    if (r === 'LAWYER' && callerName) {
      const n = callerName.trim().toLowerCase();
      return this.invoices.filter((inv) => inv.advocateName.toLowerCase() === n);
    }
    return this.invoices;
  }

  findOneInvoice(id: string): InvoiceRecord {
    const inv = this.invoices.find((i) => i.id === id);
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return inv;
  }

  updateInvoice(id: string, dto: UpdateInvoiceDto): InvoiceRecord {
    const idx = this.invoices.findIndex((i) => i.id === id);
    if (idx === -1) throw new NotFoundException(`Invoice ${id} not found`);
    const existing = this.invoices[idx];

    let clientId    = existing.clientId;
    let clientName  = existing.clientName;
    let clientEmail = existing.clientEmail;

    if (dto.clientId && dto.clientId !== existing.clientId) {
      const client = this.resolveClient(dto.clientId);
      clientId     = client.id;
      clientName   = client.fullName;
      clientEmail  = client.email;
    }

    const updated: InvoiceRecord = {
      ...existing,
      clientId,
      clientName,
      clientEmail,
      ...(dto.caseName     !== undefined && { caseName:     dto.caseName }),
      ...(dto.advocateName !== undefined && { advocateName: dto.advocateName }),
      ...(dto.amount       !== undefined && { amount:       dto.amount }),
      ...(dto.dueDate      !== undefined && { dueDate:      dto.dueDate }),
      status: deriveStatus(
        dto.status  ?? existing.status,
        dto.dueDate ?? existing.dueDate,
      ),
    };
    this.invoices[idx] = updated;
    return updated;
  }

  removeInvoice(id: string): { message: string } {
    const idx = this.invoices.findIndex((i) => i.id === id);
    if (idx === -1) throw new NotFoundException(`Invoice ${id} not found`);
    this.invoices.splice(idx, 1);
    return { message: `Invoice ${id} deleted successfully` };
  }

  getSummary(role: string, callerId?: string, callerName?: string) {
    const scoped = this.findAllInvoices(role, callerId, callerName);
    let totalBilled = 0, totalPaid = 0, pendingAmount = 0,
        overdueAmount = 0, paidCount = 0, overdueCount = 0;
    scoped.forEach((inv) => {
      totalBilled += inv.amount;
      if (inv.status === 'Paid')        { totalPaid     += inv.amount; paidCount++; }
      else if (inv.status === 'Pending'){ pendingAmount += inv.amount; }
      else if (inv.status === 'Overdue'){ overdueAmount += inv.amount; overdueCount++; }
    });
    return { totalBilled, totalPaid, pendingAmount, overdueAmount, paidCount, overdueCount };
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  findAllPayments(role: string, callerId?: string): PaymentRecord[] {
    const r = (role || '').toUpperCase().trim();
    if (r === 'CLIENT' && callerId) {
      return this.payments.filter((p) => p.clientId === callerId);
    }
    return this.payments;
  }

  findPaymentsByInvoice(invoiceId: string): PaymentRecord[] {
    return this.payments.filter((p) => p.invoiceId === invoiceId);
  }

  recordPayment(invoiceId: string, paymentMethod: string): PaymentRecord {
    const inv = this.findOneInvoice(invoiceId);
    const existing = this.payments.find((p) => p.invoiceId === invoiceId);
    const record: PaymentRecord = {
      id:            existing?.id ?? generateId('PAY'),
      invoiceId:     inv.id,
      clientId:      inv.clientId,
      clientName:    inv.clientName,
      amount:        inv.amount,
      paymentDate:   new Date().toISOString().split('T')[0],
      paymentMethod: paymentMethod || 'Credit Card',
      status:        'Completed',
    };
    if (existing) {
      this.payments[this.payments.indexOf(existing)] = record;
    } else {
      this.payments.unshift(record);
    }
    const invIdx = this.invoices.findIndex((i) => i.id === invoiceId);
    if (invIdx !== -1) this.invoices[invIdx].status = 'Paid';
    return record;
  }
}
