import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bullmq';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../database/prisma.service';
import { BillingService } from '../billing/billing.service';
import {
  INVOICE_PROVIDER,
  InvoiceProvider,
} from './providers/invoice-provider.interface';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: jest.Mocked<PrismaService>;
  let provider: jest.Mocked<InvoiceProvider>;
  let billingService: jest.Mocked<BillingService>;

  const mockPrisma = {
    billingRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    obligation: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    invoiceLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockProvider: jest.Mocked<InvoiceProvider> = {
    createDraftInvoice: jest.fn(),
    addLineItems: jest.fn(),
    finalizeInvoice: jest.fn(),
    voidInvoice: jest.fn(),
  };

  const mockBillingService = {
    transitionRun: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: INVOICE_PROVIDER, useValue: mockProvider },
        { provide: BillingService, useValue: mockBillingService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    prisma = module.get(PrismaService);
    provider = module.get(INVOICE_PROVIDER);
    billingService = module.get(BillingService);
  });

  // ────────────────────────────────────────────────────────────────────
  // Grouping Logic
  // ────────────────────────────────────────────────────────────────────

  it('should group obligations by chargeType + tenantId', async () => {
    const billingRunId = 'run-1';
    const tenantId1 = 'tenant-1';
    const tenantId2 = 'tenant-2';

    mockPrisma.billingRun.findUnique.mockResolvedValue({
      id: billingRunId,
      airportId: 'airport-1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    mockPrisma.obligation.findMany.mockResolvedValue([
      {
        id: 'obl-1',
        tenantId: tenantId1,
        chargeType: 'base_rent',
        amount: '5000.00',
        currency: 'TRY',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        dueDate: new Date('2026-02-15'),
      },
      {
        id: 'obl-2',
        tenantId: tenantId1,
        chargeType: 'base_rent',
        amount: '3000.00',
        currency: 'TRY',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        dueDate: new Date('2026-02-15'),
      },
      {
        id: 'obl-3',
        tenantId: tenantId2,
        chargeType: 'revenue_share',
        amount: '2000.00',
        currency: 'TRY',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        dueDate: new Date('2026-02-15'),
      },
    ]);

    mockPrisma.tenant.findUnique
      .mockResolvedValueOnce({ id: tenantId1, stripeCustomerId: 'cus_t1' })
      .mockResolvedValueOnce({ id: tenantId2, stripeCustomerId: 'cus_t2' });

    mockProvider.createDraftInvoice.mockResolvedValue({
      externalId: 'inv_stripe_1',
      status: 'draft',
    });
    mockProvider.finalizeInvoice.mockResolvedValue({
      externalId: 'inv_stripe_1',
      status: 'open',
      hostedUrl: 'https://stripe.com/inv/1',
      pdfUrl: 'https://stripe.com/inv/1.pdf',
      invoiceNumber: 'INV-001',
    });
    mockPrisma.invoiceLog.create.mockResolvedValue({ id: 'il-1' });

    const result = await service.generateInvoicesForRun(billingRunId);

    // Should have 2 invoice groups: (base_rent,tenant-1) and (revenue_share,tenant-2)
    expect(mockProvider.createDraftInvoice).toHaveBeenCalledTimes(2);
    expect(result.totalInvoices).toBe(2);
  });

  // ────────────────────────────────────────────────────────────────────
  // Idempotency Key
  // ────────────────────────────────────────────────────────────────────

  it('should create InvoiceLog with idempotencyKey = {billingRunId}_{chargeType}_{tenantId}', async () => {
    const billingRunId = 'run-2';
    const tenantId = 'tenant-1';

    mockPrisma.billingRun.findUnique.mockResolvedValue({
      id: billingRunId,
      airportId: 'airport-1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    mockPrisma.obligation.findMany.mockResolvedValue([
      {
        id: 'obl-1',
        tenantId,
        chargeType: 'base_rent',
        amount: '5000.00',
        currency: 'TRY',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        dueDate: new Date('2026-02-15'),
      },
    ]);

    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: tenantId,
      stripeCustomerId: 'cus_t1',
    });

    mockProvider.createDraftInvoice.mockResolvedValue({
      externalId: 'inv_stripe_1',
      status: 'draft',
    });
    mockProvider.finalizeInvoice.mockResolvedValue({
      externalId: 'inv_stripe_1',
      status: 'open',
      hostedUrl: 'https://stripe.com/inv/1',
      pdfUrl: 'https://stripe.com/inv/1.pdf',
      invoiceNumber: 'INV-001',
    });
    mockPrisma.invoiceLog.create.mockResolvedValue({ id: 'il-1' });

    await service.generateInvoicesForRun(billingRunId);

    expect(mockPrisma.invoiceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: `${billingRunId}_base_rent_${tenantId}`,
        }),
      }),
    );
  });

  // ────────────────────────────────────────────────────────────────────
  // Amount Conversion
  // ────────────────────────────────────────────────────────────────────

  it('should convert amounts to smallest currency unit (multiply by 100)', async () => {
    const billingRunId = 'run-3';

    mockPrisma.billingRun.findUnique.mockResolvedValue({
      id: billingRunId,
      airportId: 'airport-1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    mockPrisma.obligation.findMany.mockResolvedValue([
      {
        id: 'obl-1',
        tenantId: 'tenant-1',
        chargeType: 'base_rent',
        amount: '5000.50',
        currency: 'TRY',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        dueDate: new Date('2026-02-15'),
      },
    ]);

    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: 'cus_t1',
    });

    mockProvider.createDraftInvoice.mockResolvedValue({
      externalId: 'inv_1',
      status: 'draft',
    });
    mockProvider.finalizeInvoice.mockResolvedValue({
      externalId: 'inv_1',
      status: 'open',
    });
    mockPrisma.invoiceLog.create.mockResolvedValue({ id: 'il-1' });

    await service.generateInvoicesForRun(billingRunId);

    // 5000.50 TRY = 500050 kurus
    expect(mockProvider.addLineItems).toHaveBeenCalledWith(
      'inv_1',
      expect.arrayContaining([
        expect.objectContaining({ amount: 500050 }),
      ]),
      'cus_t1',
      expect.any(String),
    );
  });

  // ────────────────────────────────────────────────────────────────────
  // Obligation Status Update
  // ────────────────────────────────────────────────────────────────────

  it('should update obligations to invoiced with invoiceLogId after success', async () => {
    const billingRunId = 'run-4';

    mockPrisma.billingRun.findUnique.mockResolvedValue({
      id: billingRunId,
      airportId: 'airport-1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    mockPrisma.obligation.findMany.mockResolvedValue([
      {
        id: 'obl-1',
        tenantId: 'tenant-1',
        chargeType: 'base_rent',
        amount: '5000.00',
        currency: 'TRY',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        dueDate: new Date('2026-02-15'),
      },
    ]);

    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: 'cus_t1',
    });

    mockProvider.createDraftInvoice.mockResolvedValue({
      externalId: 'inv_1',
      status: 'draft',
    });
    mockProvider.finalizeInvoice.mockResolvedValue({
      externalId: 'inv_1',
      status: 'open',
    });
    mockPrisma.invoiceLog.create.mockResolvedValue({ id: 'il-1' });

    await service.generateInvoicesForRun(billingRunId);

    expect(mockPrisma.obligation.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['obl-1'] } },
      data: expect.objectContaining({
        status: 'invoiced',
        invoiceLogId: 'il-1',
        invoicedAt: expect.any(Date),
      }),
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Missing Stripe Customer
  // ────────────────────────────────────────────────────────────────────

  it('should skip tenant without stripeCustomerId and log error', async () => {
    const billingRunId = 'run-5';

    mockPrisma.billingRun.findUnique.mockResolvedValue({
      id: billingRunId,
      airportId: 'airport-1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    mockPrisma.obligation.findMany.mockResolvedValue([
      {
        id: 'obl-1',
        tenantId: 'tenant-no-stripe',
        chargeType: 'base_rent',
        amount: '5000.00',
        currency: 'TRY',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        dueDate: new Date('2026-02-15'),
      },
    ]);

    // Tenant has no stripeCustomerId
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-no-stripe',
      stripeCustomerId: null,
    });

    const result = await service.generateInvoicesForRun(billingRunId);

    expect(result.failureCount).toBe(1);
    expect(result.successCount).toBe(0);
    expect(mockProvider.createDraftInvoice).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────────
  // Billing Run Transitions
  // ────────────────────────────────────────────────────────────────────

  it('should return completed status when all invoices succeed', async () => {
    const billingRunId = 'run-6';

    mockPrisma.billingRun.findUnique.mockResolvedValue({
      id: billingRunId,
      airportId: 'airport-1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    mockPrisma.obligation.findMany.mockResolvedValue([
      {
        id: 'obl-1',
        tenantId: 'tenant-1',
        chargeType: 'base_rent',
        amount: '5000.00',
        currency: 'TRY',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        dueDate: new Date('2026-02-15'),
      },
    ]);

    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: 'cus_t1',
    });

    mockProvider.createDraftInvoice.mockResolvedValue({
      externalId: 'inv_1',
      status: 'draft',
    });
    mockProvider.finalizeInvoice.mockResolvedValue({
      externalId: 'inv_1',
      status: 'open',
    });
    mockPrisma.invoiceLog.create.mockResolvedValue({ id: 'il-1' });

    const result = await service.generateInvoicesForRun(billingRunId);

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(0);
  });

  it('should return partial status when some invoices fail', async () => {
    const billingRunId = 'run-7';

    mockPrisma.billingRun.findUnique.mockResolvedValue({
      id: billingRunId,
      airportId: 'airport-1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    mockPrisma.obligation.findMany.mockResolvedValue([
      {
        id: 'obl-1',
        tenantId: 'tenant-1',
        chargeType: 'base_rent',
        amount: '5000.00',
        currency: 'TRY',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        dueDate: new Date('2026-02-15'),
      },
      {
        id: 'obl-2',
        tenantId: 'tenant-2',
        chargeType: 'revenue_share',
        amount: '3000.00',
        currency: 'TRY',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        dueDate: new Date('2026-02-15'),
      },
    ]);

    mockPrisma.tenant.findUnique
      .mockResolvedValueOnce({ id: 'tenant-1', stripeCustomerId: 'cus_t1' })
      .mockResolvedValueOnce({ id: 'tenant-2', stripeCustomerId: 'cus_t2' });

    // First invoice succeeds, second fails
    mockProvider.createDraftInvoice
      .mockResolvedValueOnce({ externalId: 'inv_1', status: 'draft' })
      .mockRejectedValueOnce(new Error('Stripe API error'));

    mockProvider.finalizeInvoice.mockResolvedValue({
      externalId: 'inv_1',
      status: 'open',
    });
    mockPrisma.invoiceLog.create.mockResolvedValue({ id: 'il-1' });

    const result = await service.generateInvoicesForRun(billingRunId);

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.errors.length).toBe(1);
  });

  // ────────────────────────────────────────────────────────────────────
  // Line Item Description
  // ────────────────────────────────────────────────────────────────────

  it('should build line item description as "{chargeType} - {periodStart YYYY-MM}"', async () => {
    const billingRunId = 'run-8';

    mockPrisma.billingRun.findUnique.mockResolvedValue({
      id: billingRunId,
      airportId: 'airport-1',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
    });

    mockPrisma.obligation.findMany.mockResolvedValue([
      {
        id: 'obl-1',
        tenantId: 'tenant-1',
        chargeType: 'base_rent',
        amount: '5000.00',
        currency: 'TRY',
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        dueDate: new Date('2026-04-15'),
      },
    ]);

    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      stripeCustomerId: 'cus_t1',
    });

    mockProvider.createDraftInvoice.mockResolvedValue({
      externalId: 'inv_1',
      status: 'draft',
    });
    mockProvider.finalizeInvoice.mockResolvedValue({
      externalId: 'inv_1',
      status: 'open',
    });
    mockPrisma.invoiceLog.create.mockResolvedValue({ id: 'il-1' });

    await service.generateInvoicesForRun(billingRunId);

    expect(mockProvider.addLineItems).toHaveBeenCalledWith(
      'inv_1',
      expect.arrayContaining([
        expect.objectContaining({
          description: 'base_rent - 2026-03',
        }),
      ]),
      'cus_t1',
      expect.any(String),
    );
  });

  // ────────────────────────────────────────────────────────────────────
  // Read Queries
  // ────────────────────────────────────────────────────────────────────

  it('should list invoices with filters and pagination', async () => {
    mockPrisma.invoiceLog.findMany.mockResolvedValue([]);
    mockPrisma.invoiceLog.count.mockResolvedValue(0);

    const result = await service.findAll({
      tenantId: 'tenant-1',
      page: 1,
      limit: 10,
    });

    expect(mockPrisma.invoiceLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
        skip: 0,
        take: 10,
      }),
    );
    expect(result).toHaveProperty('meta');
  });

  it('should get a single invoice by ID', async () => {
    mockPrisma.invoiceLog.findUnique.mockResolvedValue({
      id: 'il-1',
      stripeInvoiceId: 'inv_1',
    });

    const result = await service.findOne('il-1');
    expect(result).toBeDefined();
    expect(mockPrisma.invoiceLog.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'il-1' } }),
    );
  });
});
