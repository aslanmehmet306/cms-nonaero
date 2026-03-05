import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../database/prisma.service';
import { InvoiceStatus } from '@shared-types/enums';

// We do NOT mock Stripe for webhook.service tests — we test the handleEvent logic
// which receives an already-verified Stripe.Event object.

describe('WebhookService', () => {
  let service: WebhookService;

  const mockPrisma = {
    webhookEventLog: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    invoiceLog: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('sk_test_mock'),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  // Helper: build a mock Stripe event
  function buildEvent(
    type: string,
    invoiceId: string,
    eventId = 'evt_test_1',
  ): any {
    return {
      id: eventId,
      type,
      data: {
        object: { id: invoiceId },
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // invoice.paid -> InvoiceStatus.paid + set paidAt
  // ────────────────────────────────────────────────────────────────────

  it('should update InvoiceLog status to paid and set paidAt on invoice.paid', async () => {
    const event = buildEvent('invoice.paid', 'inv_123');

    mockPrisma.webhookEventLog.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEventLog.upsert.mockResolvedValue({});
    mockPrisma.invoiceLog.findUnique.mockResolvedValue({
      id: 'il-1',
      stripeInvoiceId: 'inv_123',
      status: InvoiceStatus.finalized,
    });
    mockPrisma.invoiceLog.update.mockResolvedValue({});
    mockPrisma.webhookEventLog.update.mockResolvedValue({});

    await service.handleEvent(event);

    expect(mockPrisma.invoiceLog.update).toHaveBeenCalledWith({
      where: { stripeInvoiceId: 'inv_123' },
      data: expect.objectContaining({
        status: InvoiceStatus.paid,
        paidAt: expect.any(Date),
      }),
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // invoice.payment_failed -> past_due
  // ────────────────────────────────────────────────────────────────────

  it('should update InvoiceLog status to past_due on invoice.payment_failed', async () => {
    const event = buildEvent('invoice.payment_failed', 'inv_456');

    mockPrisma.webhookEventLog.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEventLog.upsert.mockResolvedValue({});
    mockPrisma.invoiceLog.findUnique.mockResolvedValue({
      id: 'il-2',
      stripeInvoiceId: 'inv_456',
      status: InvoiceStatus.finalized,
    });
    mockPrisma.invoiceLog.update.mockResolvedValue({});
    mockPrisma.webhookEventLog.update.mockResolvedValue({});

    await service.handleEvent(event);

    expect(mockPrisma.invoiceLog.update).toHaveBeenCalledWith({
      where: { stripeInvoiceId: 'inv_456' },
      data: expect.objectContaining({
        status: InvoiceStatus.past_due,
      }),
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // invoice.voided -> voided + set voidedAt
  // ────────────────────────────────────────────────────────────────────

  it('should update InvoiceLog status to voided and set voidedAt on invoice.voided', async () => {
    const event = buildEvent('invoice.voided', 'inv_789');

    mockPrisma.webhookEventLog.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEventLog.upsert.mockResolvedValue({});
    mockPrisma.invoiceLog.findUnique.mockResolvedValue({
      id: 'il-3',
      stripeInvoiceId: 'inv_789',
      status: InvoiceStatus.finalized,
    });
    mockPrisma.invoiceLog.update.mockResolvedValue({});
    mockPrisma.webhookEventLog.update.mockResolvedValue({});

    await service.handleEvent(event);

    expect(mockPrisma.invoiceLog.update).toHaveBeenCalledWith({
      where: { stripeInvoiceId: 'inv_789' },
      data: expect.objectContaining({
        status: InvoiceStatus.voided,
        voidedAt: expect.any(Date),
      }),
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Deduplication: skip already-processed events
  // ────────────────────────────────────────────────────────────────────

  it('should skip already-processed events (deduplication)', async () => {
    const event = buildEvent('invoice.paid', 'inv_123', 'evt_duplicate');

    // Event already processed
    mockPrisma.webhookEventLog.findUnique.mockResolvedValue({
      id: 'wh-1',
      stripeEventId: 'evt_duplicate',
      processed: true,
    });

    await service.handleEvent(event);

    // Should NOT call invoiceLog.update (event was skipped)
    expect(mockPrisma.invoiceLog.update).not.toHaveBeenCalled();
    // Should NOT upsert again
    expect(mockPrisma.webhookEventLog.upsert).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────────
  // WebhookEventLog entry creation
  // ────────────────────────────────────────────────────────────────────

  it('should create WebhookEventLog entry and mark processed after handling', async () => {
    const event = buildEvent('invoice.paid', 'inv_123', 'evt_new');

    mockPrisma.webhookEventLog.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEventLog.upsert.mockResolvedValue({});
    mockPrisma.invoiceLog.findUnique.mockResolvedValue({
      id: 'il-1',
      stripeInvoiceId: 'inv_123',
    });
    mockPrisma.invoiceLog.update.mockResolvedValue({});
    mockPrisma.webhookEventLog.update.mockResolvedValue({});

    await service.handleEvent(event);

    // Should create/upsert webhook event log entry
    expect(mockPrisma.webhookEventLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeEventId: 'evt_new' },
        create: expect.objectContaining({
          stripeEventId: 'evt_new',
          eventType: 'invoice.paid',
          payload: event.data,
        }),
      }),
    );

    // Should mark as processed after successful handling
    expect(mockPrisma.webhookEventLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeEventId: 'evt_new' },
        data: expect.objectContaining({
          processed: true,
          processedAt: expect.any(Date),
        }),
      }),
    );
  });

  // ────────────────────────────────────────────────────────────────────
  // Unknown invoice (graceful handling)
  // ────────────────────────────────────────────────────────────────────

  it('should handle unknown invoice gracefully (event references non-existent stripeInvoiceId)', async () => {
    const event = buildEvent('invoice.paid', 'inv_unknown', 'evt_unknown');

    mockPrisma.webhookEventLog.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEventLog.upsert.mockResolvedValue({});
    // Invoice NOT in system
    mockPrisma.invoiceLog.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEventLog.update.mockResolvedValue({});

    // Should NOT throw — graceful handling
    await expect(service.handleEvent(event)).resolves.not.toThrow();

    // Should NOT try to update non-existent invoice
    expect(mockPrisma.invoiceLog.update).not.toHaveBeenCalled();

    // Should still mark webhook event as processed
    expect(mockPrisma.webhookEventLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processed: true }),
      }),
    );
  });

  // ────────────────────────────────────────────────────────────────────
  // WebhookController always returns 200
  // ────────────────────────────────────────────────────────────────────

  it('should emit invoice.paid event through EventEmitter2', async () => {
    const event = buildEvent('invoice.paid', 'inv_123', 'evt_emit');

    mockPrisma.webhookEventLog.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEventLog.upsert.mockResolvedValue({});
    mockPrisma.invoiceLog.findUnique.mockResolvedValue({
      id: 'il-1',
      stripeInvoiceId: 'inv_123',
    });
    mockPrisma.invoiceLog.update.mockResolvedValue({});
    mockPrisma.webhookEventLog.update.mockResolvedValue({});

    await service.handleEvent(event);

    expect(mockEventEmitter.emit).toHaveBeenCalledWith('invoice.paid', {
      stripeInvoiceId: 'inv_123',
    });
  });
});
