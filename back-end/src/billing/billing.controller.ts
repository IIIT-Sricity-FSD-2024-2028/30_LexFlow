import { FirmWrite } from '../common/decorators/firm-write.decorator';
import {
  Controller, Get, Post, Body, Patch, Param,
  Delete, HttpCode, HttpStatus, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader,
} from '@nestjs/swagger';
import {
  BillingService, InvoiceRecord, PaymentRecord, ClientEntry, InvoiceCaseEntry,
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
@ApiHeader({ name: 'role', description: 'client | firmadmin | superadmin', required: true })
@UseGuards(RolesGuard)
@FirmWrite()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) { }

  private invoiceActor(req: { user?: { id: string; role: string; firmId?: string } }) {
    if (!req.user) throw new UnauthorizedException('Login required');
    return req.user;
  }

  @Get('cases')
  @Roles(UserRole.FIRMADMIN)
  getCases(@Req() req): ApiWrapper<InvoiceCaseEntry[]> {
    return ok('Cases retrieved successfully', this.billingService.getInvoiceCases(this.invoiceActor(req).firmId));
  }

  // GET /billing/clients
  @Get('clients')
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  async getClients(@Req() req): Promise<ApiWrapper<ClientEntry[]>> {
    return ok(
      'Clients retrieved successfully',
      await this.billingService.getClients(this.invoiceActor(req).id),
    );
  }

  // POST /billing/invoices
  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created' })
  @ApiResponse({ status: 404, description: 'Client ID not found or not a client' })
  async createInvoice(
    @Body() dto: CreateInvoiceDto,
    @Req() req,
  ): Promise<ApiWrapper<InvoiceRecord>> {
    return ok('Invoice created successfully', await this.billingService.createInvoice(dto, this.invoiceActor(req).firmId));
  }

  // GET /billing/invoices
  @Get('invoices')
  @Roles(UserRole.CLIENT, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Get invoices (role-scoped)',
    description:
      'CLIENT ? their own invoices.\n' +
      'FIRMADMIN ? invoices for their firm.\n' +
      'SUPERADMIN ? all invoices.',
  })
  async findAllInvoices(@Req() req): Promise<ApiWrapper<InvoiceRecord[]>> {
    const actor = this.invoiceActor(req);
    return ok('Invoices retrieved successfully',
      await this.billingService.findAllInvoices(actor.role, actor.id));
  }

  // GET /billing/invoices/summary
  @Get('invoices/summary')
  @Roles(UserRole.CLIENT, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Billing summary stats (role-scoped)' })
  async getSummary(@Req() req): Promise<ApiWrapper<object>> {
    const actor = this.invoiceActor(req);
    return ok('Summary retrieved successfully',
      await this.billingService.getSummary(actor.role, actor.id));
  }

  // GET /billing/invoices/:id
  @Get('invoices/:id')
  @Roles(UserRole.CLIENT, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get single invoice by ID' })
  @ApiParam({ name: 'id', example: 'INV-A1B2C3D4' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findOneInvoice(@Param('id') id: string, @Req() req): Promise<ApiWrapper<InvoiceRecord>> {
    this.invoiceActor(req);
    return ok('Invoice retrieved successfully', await this.billingService.findOneInvoice(id));
  }

  // PATCH /billing/invoices/:id
  @Patch('invoices/:id')
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update an invoice (partial)' })
  @ApiParam({ name: 'id', example: 'INV-A1B2C3D4' })
  async updateInvoice(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @Req() req,
  ): Promise<ApiWrapper<InvoiceRecord>> {
    return ok('Invoice updated successfully', await this.billingService.updateInvoice(id, dto, this.invoiceActor(req)));
  }

  // DELETE /billing/invoices/:id
  @Delete('invoices/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Delete an invoice' })
  @ApiParam({ name: 'id', example: 'INV-A1B2C3D4' })
  async removeInvoice(@Param('id') id: string): Promise<ApiWrapper<null>> {
    return ok((await this.billingService.removeInvoice(id)).message, null);
  }

  // GET /billing/payments
  @Get('payments')
  @Roles(UserRole.CLIENT, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get payments (role-scoped)' })
  async findAllPayments(@Req() req): Promise<ApiWrapper<PaymentRecord[]>> {
    const actor = this.invoiceActor(req);
    return ok('Payments retrieved successfully',
      await this.billingService.findAllPayments(actor.role, actor.id));
  }

  // GET /billing/payments/invoice/:invoiceId
  @Get('payments/invoice/:invoiceId')
  @Roles(UserRole.CLIENT, UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get payments for a specific invoice' })
  @ApiParam({ name: 'invoiceId', example: 'INV-A1B2C3D4' })
  async findPaymentsByInvoice(
    @Param('invoiceId') invoiceId: string,
    @Req() req,
  ): Promise<ApiWrapper<PaymentRecord[]>> {
    this.invoiceActor(req);
    return ok('Payments retrieved successfully',
      await this.billingService.findPaymentsByInvoice(invoiceId));
  }

  // POST /billing/payments/:invoiceId
  @Post('payments/:invoiceId')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Record a payment — CLIENT only' })
  @ApiParam({ name: 'invoiceId', example: 'INV-A1B2C3D4' })
  async recordPayment(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<ApiWrapper<PaymentRecord>> {
    return ok(
      'Payment recorded. Invoice marked as Paid.',
      await this.billingService.recordPayment(invoiceId, dto.paymentMethod),
    );
  }
}
