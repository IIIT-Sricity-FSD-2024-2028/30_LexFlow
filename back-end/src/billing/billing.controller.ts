import {
  Controller, Get, Post, Body, Patch, Param,
  Delete, HttpCode, HttpStatus, UseGuards, Headers,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader,
} from '@nestjs/swagger';
import {
  BillingService, InvoiceRecord, PaymentRecord, ClientEntry,
} from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

interface ApiWrapper<T> { success: boolean; message: string; data: T; }
const ok = <T>(message: string, data: T): ApiWrapper<T> => ({ success: true, message, data });

@ApiTags('Billing')
@ApiHeader({ name: 'role', description: 'client | lawyer | intern | firmadmin | superadmin', required: true })
@ApiHeader({ name: 'x-user-id', description: 'Caller user-id (for CLIENT/LAWYER scoped views)', required: false })
@UseGuards(RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) { }

  // GET /billing/clients
  @Get('clients')
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.SUPERADMIN)
  getClients(
    @Headers('x-user-id') callerId: string,
  ): ApiWrapper<ClientEntry[]> {
    return ok(
      'Clients retrieved successfully',
      this.billingService.getClients(callerId),
    );
  }

  // POST /billing/invoices
  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created' })
  @ApiResponse({ status: 404, description: 'Client ID not found or not a client' })
  createInvoice(@Body() dto: CreateInvoiceDto): ApiWrapper<InvoiceRecord> {
    return ok('Invoice created successfully', this.billingService.createInvoice(dto));
  }

  // GET /billing/invoices
  @Get('invoices')
  @Roles(UserRole.CLIENT, UserRole.LAWYER, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Get invoices (role-scoped)',
    description:
      'CLIENT → only their own invoices (pass `x-user-id`).\n' +
      'LAWYER → invoices where they are the advocate (pass `x-user-name`).\n' +
      'FIRMADMIN / SUPERADMIN → all invoices.',
  })
  findAllInvoices(
    @Headers('role') role: string,
    @Headers('x-user-id') callerId: string,
    @Headers('x-user-name') callerName: string,
  ): ApiWrapper<InvoiceRecord[]> {
    return ok('Invoices retrieved successfully',
      this.billingService.findAllInvoices(role, callerId, callerName));
  }

  // GET /billing/invoices/summary
  @Get('invoices/summary')
  @Roles(UserRole.CLIENT, UserRole.LAWYER, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Billing summary stats (role-scoped)' })
  getSummary(
    @Headers('role') role: string,
    @Headers('x-user-id') callerId: string,
    @Headers('x-user-name') callerName: string,
  ): ApiWrapper<object> {
    return ok('Summary retrieved successfully',
      this.billingService.getSummary(role, callerId, callerName));
  }

  // GET /billing/invoices/:id
  @Get('invoices/:id')
  @Roles(UserRole.CLIENT, UserRole.LAWYER, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get single invoice by ID' })
  @ApiParam({ name: 'id', example: 'INV-A1B2C3D4' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  findOneInvoice(@Param('id') id: string): ApiWrapper<InvoiceRecord> {
    return ok('Invoice retrieved successfully', this.billingService.findOneInvoice(id));
  }

  // PATCH /billing/invoices/:id
  @Patch('invoices/:id')
  @Roles(UserRole.FIRMADMIN, UserRole.LAWYER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update an invoice (partial)' })
  @ApiParam({ name: 'id', example: 'INV-A1B2C3D4' })
  updateInvoice(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ): ApiWrapper<InvoiceRecord> {
    return ok('Invoice updated successfully', this.billingService.updateInvoice(id, dto));
  }

  // DELETE /billing/invoices/:id
  @Delete('invoices/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Delete an invoice' })
  @ApiParam({ name: 'id', example: 'INV-A1B2C3D4' })
  removeInvoice(@Param('id') id: string): ApiWrapper<null> {
    return ok(this.billingService.removeInvoice(id).message, null);
  }

  // GET /billing/payments
  @Get('payments')
  @Roles(UserRole.CLIENT, UserRole.LAWYER, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get payments (role-scoped)' })
  findAllPayments(
    @Headers('role') role: string,
    @Headers('x-user-id') callerId: string,
  ): ApiWrapper<PaymentRecord[]> {
    return ok('Payments retrieved successfully',
      this.billingService.findAllPayments(role, callerId));
  }

  // GET /billing/payments/invoice/:invoiceId
  @Get('payments/invoice/:invoiceId')
  @Roles(UserRole.CLIENT, UserRole.LAWYER, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get payments for a specific invoice' })
  @ApiParam({ name: 'invoiceId', example: 'INV-A1B2C3D4' })
  findPaymentsByInvoice(
    @Param('invoiceId') invoiceId: string,
  ): ApiWrapper<PaymentRecord[]> {
    return ok('Payments retrieved successfully',
      this.billingService.findPaymentsByInvoice(invoiceId));
  }

  // POST /billing/payments/:invoiceId
  @Post('payments/:invoiceId')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Record a payment — CLIENT only' })
  @ApiParam({ name: 'invoiceId', example: 'INV-A1B2C3D4' })
  recordPayment(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: RecordPaymentDto,
  ): ApiWrapper<PaymentRecord> {
    return ok(
      'Payment recorded. Invoice marked as Paid.',
      this.billingService.recordPayment(invoiceId, dto.paymentMethod),
    );
  }
}