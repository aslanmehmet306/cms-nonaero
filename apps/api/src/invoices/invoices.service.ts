import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceStatus, ObligationStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { DecimalHelper } from '../common/utils/decimal-helper';
import {
  INVOICE_PROVIDER,
  InvoiceProvider,
  InvoiceLineItem,
} from './providers/invoice-provider.interface';

interface ObligationRecord {
  id: string;
  tenantId: string;
  chargeType: string;
  amount: string;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
}

interface InvoiceGenerationResult {
  totalInvoices: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ group: string; error: string }>;
}

/**
 * InvoicesService handles invoice generation from billing run obligations.
 *
 * Responsibilities:
 * - Group obligations by chargeType + tenantId
 * - Call InvoiceProvider (Stripe/ERP) for each group
 * - Create InvoiceLog records with idempotency keys
 * - Update obligation status to 'invoiced' with invoiceLogId link
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(INVOICE_PROVIDER) private readonly invoiceProvider: InvoiceProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Generate Invoices for a Billing Run
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate invoices for all obligations in a billing run.
   *
   * 1. Load obligations linked to the billing run (status=ready)
   * 2. Group by chargeType + tenantId
   * 3. For each group: create draft invoice, add line items, finalize
   * 4. Create InvoiceLog with idempotency key
   * 5. Update obligations to invoiced with invoiceLogId
   *
   * @returns Summary with success/failure counts
   */
  async generateInvoicesForRun(billingRunId: string): Promise<InvoiceGenerationResult> {
    const billingRun = await this.prisma.billingRun.findUnique({
      where: { id: billingRunId },
    });

    if (!billingRun) {
      throw new NotFoundException(`Billing run ${billingRunId} not found`);
    }

    // Load obligations for this billing run that are ready to invoice
    const obligations = await this.prisma.obligation.findMany({
      where: {
        billingRunId,
        status: ObligationStatus.ready,
      },
    });

    if (obligations.length === 0) {
      this.logger.warn(`No ready obligations found for billing run ${billingRunId}`);
      return { totalInvoices: 0, successCount: 0, failureCount: 0, errors: [] };
    }

    // Group obligations by chargeType_tenantId
    const groups = new Map<string, ObligationRecord[]>();
    for (const obl of obligations) {
      const key = `${obl.chargeType}_${obl.tenantId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(obl as unknown as ObligationRecord);
    }

    const totalInvoices = groups.size;
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ group: string; error: string }> = [];

    for (const [groupKey, groupObligations] of groups) {
      try {
        await this.processInvoiceGroup(
          billingRunId,
          billingRun.airportId,
          groupKey,
          groupObligations,
        );
        successCount++;
      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ group: groupKey, error: errorMessage });
        this.logger.error(
          `Invoice generation failed for group ${groupKey}: ${errorMessage}`,
        );
      }
    }

    this.logger.log(
      `Invoice generation for billing run ${billingRunId}: ` +
        `${successCount}/${totalInvoices} succeeded, ${failureCount} failed`,
    );

    return { totalInvoices, successCount, failureCount, errors };
  }

  /**
   * Process a single invoice group (chargeType + tenantId).
   */
  private async processInvoiceGroup(
    billingRunId: string,
    airportId: string,
    groupKey: string,
    obligations: ObligationRecord[],
  ): Promise<void> {
    const firstObl = obligations[0];
    const { tenantId, chargeType, currency, dueDate } = firstObl;

    // Load tenant to get stripeCustomerId
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || !tenant.stripeCustomerId) {
      throw new Error(
        `Tenant ${tenantId} has no stripeCustomerId — cannot create invoice`,
      );
    }

    const idempotencyKey = `${billingRunId}_${chargeType}_${tenantId}`;

    // Step 1: Create draft invoice
    const draftInvoice = await this.invoiceProvider.createDraftInvoice({
      customerId: tenant.stripeCustomerId,
      currency: currency.toLowerCase(),
      dueDate: new Date(dueDate),
      metadata: {
        billingRunId,
        chargeType,
        tenantId,
        airportId,
      },
      idempotencyKey,
    });

    // Step 2: Build and add line items
    const lineItems: InvoiceLineItem[] = obligations.map((obl) => {
      const periodYearMonth = new Date(obl.periodStart)
        .toISOString()
        .slice(0, 7); // YYYY-MM

      return {
        description: `${obl.chargeType} - ${periodYearMonth}`,
        amount: Math.round(
          DecimalHelper.multiply(obl.amount, 100).toNumber(),
        ),
        currency: obl.currency.toLowerCase(),
        metadata: { obligationId: obl.id },
      };
    });

    await this.invoiceProvider.addLineItems(
      draftInvoice.externalId,
      lineItems,
      tenant.stripeCustomerId,
      idempotencyKey,
    );

    // Step 3: Finalize invoice
    const finalizedInvoice = await this.invoiceProvider.finalizeInvoice(
      draftInvoice.externalId,
    );

    // Step 4: Create InvoiceLog record
    const totalAmount = obligations.reduce(
      (sum, obl) => DecimalHelper.add(sum, obl.amount),
      DecimalHelper.add(0, 0),
    );

    const invoiceLog = await this.prisma.invoiceLog.create({
      data: {
        airportId,
        billingRunId,
        tenantId,
        chargeType: chargeType as any,
        stripeInvoiceId: finalizedInvoice.externalId,
        stripeInvoiceNumber: finalizedInvoice.invoiceNumber ?? null,
        stripeHostedUrl: finalizedInvoice.hostedUrl ?? null,
        stripePdfUrl: finalizedInvoice.pdfUrl ?? null,
        status: InvoiceStatus.finalized,
        amountTotal: totalAmount.toFixed(2),
        currency: currency.toUpperCase(),
        dueDate: new Date(dueDate),
        idempotencyKey,
        metadata: {
          obligationIds: obligations.map((o) => o.id),
          chargeType,
        },
      },
    });

    // Step 5: Update obligations to invoiced
    const obligationIds = obligations.map((o) => o.id);
    await this.prisma.obligation.updateMany({
      where: { id: { in: obligationIds } },
      data: {
        status: ObligationStatus.invoiced,
        invoiceLogId: invoiceLog.id,
        invoicedAt: new Date(),
      },
    });

    this.logger.log(
      `Invoice ${finalizedInvoice.externalId} created for group ${groupKey}: ` +
        `${obligations.length} obligations, total ${totalAmount.toFixed(2)} ${currency}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Read Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List InvoiceLogs with optional filters and pagination.
   */
  async findAll(query: {
    tenantId?: string;
    billingRunId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.billingRunId) where.billingRunId = query.billingRunId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.invoiceLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoiceLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single InvoiceLog by ID with linked obligations.
   */
  async findOne(id: string) {
    const invoiceLog = await this.prisma.invoiceLog.findUnique({
      where: { id },
      include: {
        obligations: true,
        tenant: { select: { id: true, name: true, code: true } },
      },
    });

    if (!invoiceLog) {
      throw new NotFoundException(`InvoiceLog ${id} not found`);
    }

    return invoiceLog;
  }
}
