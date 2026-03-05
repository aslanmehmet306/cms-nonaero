import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeInvoiceProvider } from './stripe-invoice.provider';

// Mock Stripe constructor and API
const mockInvoicesCreate = jest.fn();
const mockInvoiceItemsCreate = jest.fn();
const mockInvoicesFinalize = jest.fn();
const mockInvoicesVoid = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    invoices: {
      create: mockInvoicesCreate,
      finalizeInvoice: mockInvoicesFinalize,
      voidInvoice: mockInvoicesVoid,
    },
    invoiceItems: {
      create: mockInvoiceItemsCreate,
    },
  }));
});

describe('StripeInvoiceProvider', () => {
  let provider: StripeInvoiceProvider;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeInvoiceProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('sk_test_mock'),
          },
        },
      ],
    }).compile();

    provider = module.get<StripeInvoiceProvider>(StripeInvoiceProvider);
  });

  it('should call stripe.invoices.create with correct params and idempotencyKey', async () => {
    mockInvoicesCreate.mockResolvedValue({
      id: 'inv_123',
      number: null,
      hosted_invoice_url: null,
      invoice_pdf: null,
      status: 'draft',
    });

    const result = await provider.createDraftInvoice({
      customerId: 'cus_abc',
      currency: 'TRY',
      dueDate: new Date('2026-02-15'),
      metadata: { billingRunId: 'run-1' },
      idempotencyKey: 'run-1_base_rent_tenant-1',
    });

    expect(mockInvoicesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_abc',
        currency: 'try',
        collection_method: 'send_invoice',
        days_until_due: 30,
      }),
      expect.objectContaining({
        idempotencyKey: 'run-1_base_rent_tenant-1_create',
      }),
    );

    expect(result.externalId).toBe('inv_123');
    expect(result.status).toBe('draft');
  });

  it('should call stripe.invoiceItems.create for each line item with amount in smallest unit', async () => {
    mockInvoiceItemsCreate.mockResolvedValue({ id: 'ii_1' });

    await provider.addLineItems(
      'inv_123',
      [
        {
          description: 'base_rent - 2026-01',
          amount: 500050, // 5000.50 TRY in kurus
          currency: 'try',
          metadata: { obligationId: 'obl-1' },
        },
        {
          description: 'service_charge - 2026-01',
          amount: 100000,
          currency: 'try',
          metadata: { obligationId: 'obl-2' },
        },
      ],
      'cus_abc',
      'run-1_base_rent_tenant-1',
    );

    expect(mockInvoiceItemsCreate).toHaveBeenCalledTimes(2);
    expect(mockInvoiceItemsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_abc',
        invoice: 'inv_123',
        amount: 500050,
        currency: 'try',
        description: 'base_rent - 2026-01',
      }),
      expect.objectContaining({
        idempotencyKey: 'run-1_base_rent_tenant-1_item_0',
      }),
    );
  });

  it('should call stripe.invoices.finalizeInvoice and return hosted URL', async () => {
    mockInvoicesFinalize.mockResolvedValue({
      id: 'inv_123',
      number: 'INV-0001',
      hosted_invoice_url: 'https://pay.stripe.com/inv/123',
      invoice_pdf: 'https://pay.stripe.com/inv/123/pdf',
      status: 'open',
    });

    const result = await provider.finalizeInvoice('inv_123');

    expect(mockInvoicesFinalize).toHaveBeenCalledWith('inv_123');
    expect(result.externalId).toBe('inv_123');
    expect(result.invoiceNumber).toBe('INV-0001');
    expect(result.hostedUrl).toBe('https://pay.stripe.com/inv/123');
    expect(result.pdfUrl).toBe('https://pay.stripe.com/inv/123/pdf');
    expect(result.status).toBe('open');
  });

  it('should call stripe.invoices.voidInvoice', async () => {
    mockInvoicesVoid.mockResolvedValue({ id: 'inv_123' });

    await provider.voidInvoice('inv_123');

    expect(mockInvoicesVoid).toHaveBeenCalledWith('inv_123');
  });

  it('should lowercase currency before sending to Stripe', async () => {
    mockInvoicesCreate.mockResolvedValue({
      id: 'inv_123',
      number: null,
      hosted_invoice_url: null,
      invoice_pdf: null,
      status: 'draft',
    });

    await provider.createDraftInvoice({
      customerId: 'cus_abc',
      currency: 'EUR',
      dueDate: new Date('2026-02-15'),
      metadata: {},
      idempotencyKey: 'key-1',
    });

    expect(mockInvoicesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'eur' }),
      expect.any(Object),
    );
  });
});
