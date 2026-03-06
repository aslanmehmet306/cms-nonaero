import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email/email.service';
import { PrismaService } from '../database/prisma.service';
import {
  NotificationType,
  NotificationChannel,
} from '@shared-types/enums';
import { NotificationsListener } from './notifications.listener';

// ============================================================================
// NotificationsService Tests
// ============================================================================

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrisma = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockEmailService = {
    sendTemplate: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // notify creates Notification record in database
  // ──────────────────────────────────────────────────────────────────────────

  it('should create a Notification record in database via notify()', async () => {
    const created = {
      id: 'n-1',
      airportId: 'ap-1',
      tenantId: 'tn-1',
      type: NotificationType.invoice_created,
      channel: NotificationChannel.in_app,
      title: 'Fatura Olusturuldu',
      body: 'Faturaniz olusturulmustur.',
      isRead: false,
    };
    mockPrisma.notification.create.mockResolvedValue(created);

    const result = await service.notify({
      airportId: 'ap-1',
      tenantId: 'tn-1',
      type: NotificationType.invoice_created,
      channel: NotificationChannel.in_app,
      title: 'Fatura Olusturuldu',
      body: 'Faturaniz olusturulmustur.',
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        airportId: 'ap-1',
        tenantId: 'tn-1',
        type: NotificationType.invoice_created,
        channel: NotificationChannel.in_app,
        title: 'Fatura Olusturuldu',
        body: 'Faturaniz olusturulmustur.',
      }),
    });
    expect(result).toEqual(created);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // notify with channel=email calls EmailService.sendTemplate
  // ──────────────────────────────────────────────────────────────────────────

  it('should call EmailService.sendTemplate when channel=email', async () => {
    const created = {
      id: 'n-2',
      airportId: 'ap-1',
      tenantId: 'tn-1',
      type: NotificationType.invoice_created,
      channel: NotificationChannel.email,
      title: 'Fatura',
      body: 'Body',
    };
    mockPrisma.notification.create.mockResolvedValue(created);
    mockPrisma.notification.update.mockResolvedValue({});
    mockEmailService.sendTemplate.mockResolvedValue(undefined);

    await service.notify({
      airportId: 'ap-1',
      tenantId: 'tn-1',
      type: NotificationType.invoice_created,
      channel: NotificationChannel.email,
      title: 'Fatura',
      body: 'Body',
      emailTo: 'tenant@test.com',
      emailContext: { tenantName: 'Test Tenant' },
    });

    expect(mockEmailService.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'tenant@test.com',
        template: 'invoice-created',
        context: expect.objectContaining({ tenantName: 'Test Tenant' }),
      }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // notify with channel=in_app emits 'notification.created' event
  // ──────────────────────────────────────────────────────────────────────────

  it('should emit notification.created event when channel=in_app', async () => {
    const created = {
      id: 'n-3',
      airportId: 'ap-1',
      type: NotificationType.billing_run_completed,
      channel: NotificationChannel.in_app,
      title: 'Billing Complete',
      body: 'Done',
    };
    mockPrisma.notification.create.mockResolvedValue(created);

    await service.notify({
      airportId: 'ap-1',
      type: NotificationType.billing_run_completed,
      channel: NotificationChannel.in_app,
      title: 'Billing Complete',
      body: 'Done',
    });

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'notification.created',
      expect.objectContaining({
        notification: created,
        severity: 'info',
      }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // notify with channel=both sends email AND emits event
  // ──────────────────────────────────────────────────────────────────────────

  it('should send email AND emit event when channel=both', async () => {
    const created = {
      id: 'n-4',
      airportId: 'ap-1',
      tenantId: 'tn-1',
      type: NotificationType.payment_received,
      channel: NotificationChannel.both,
      title: 'Odeme Alindi',
      body: 'Odeme basarili.',
    };
    mockPrisma.notification.create.mockResolvedValue(created);
    mockPrisma.notification.update.mockResolvedValue({});
    mockEmailService.sendTemplate.mockResolvedValue(undefined);

    await service.notify({
      airportId: 'ap-1',
      tenantId: 'tn-1',
      type: NotificationType.payment_received,
      channel: NotificationChannel.both,
      title: 'Odeme Alindi',
      body: 'Odeme basarili.',
      emailTo: 'tenant@test.com',
      emailContext: { tenantName: 'Tenant' },
    });

    // Both email and event
    expect(mockEmailService.sendTemplate).toHaveBeenCalled();
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'notification.created',
      expect.objectContaining({ notification: created }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getSeverity maps NotificationType to correct severity
  // ──────────────────────────────────────────────────────────────────────────

  it('should map NotificationType to correct severity levels', () => {
    expect(service.getSeverity(NotificationType.cutoff_approaching)).toBe('warning');
    expect(service.getSeverity(NotificationType.declaration_missing)).toBe('warning');
    expect(service.getSeverity(NotificationType.invoice_created)).toBe('info');
    expect(service.getSeverity(NotificationType.payment_received)).toBe('info');
    expect(service.getSeverity(NotificationType.payment_failed)).toBe('error');
    expect(service.getSeverity(NotificationType.invoice_overdue)).toBe('error');
    expect(service.getSeverity(NotificationType.billing_run_completed)).toBe('info');
    expect(service.getSeverity(NotificationType.contract_expiring)).toBe('warning');
    expect(service.getSeverity(NotificationType.mag_shortfall)).toBe('warning');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findAll returns paginated notifications filtered by tenantId and isRead
  // ──────────────────────────────────────────────────────────────────────────

  it('should return paginated notifications filtered by tenantId and isRead', async () => {
    const items = [
      { id: 'n-10', tenantId: 'tn-1', isRead: false },
      { id: 'n-11', tenantId: 'tn-1', isRead: false },
    ];
    mockPrisma.notification.findMany.mockResolvedValue(items);
    mockPrisma.notification.count.mockResolvedValue(2);

    const result = await service.findAll({
      tenantId: 'tn-1',
      isRead: false,
      page: 1,
      limit: 20,
    });

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tn-1', isRead: false }),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result.data).toEqual(items);
    expect(result.meta.total).toBe(2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // markAsRead updates isRead=true and readAt timestamp
  // ──────────────────────────────────────────────────────────────────────────

  it('should mark a notification as read with isRead=true and readAt', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue({ id: 'n-20', isRead: false });
    mockPrisma.notification.update.mockResolvedValue({
      id: 'n-20',
      isRead: true,
      readAt: expect.any(Date),
    });

    await service.markAsRead('n-20');

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-20' },
      data: expect.objectContaining({
        isRead: true,
        readAt: expect.any(Date),
      }),
    });
  });

  it('should throw NotFoundException when markAsRead for non-existent notification', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue(null);

    await expect(service.markAsRead('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});

// ============================================================================
// NotificationsListener Tests
// ============================================================================

describe('NotificationsListener', () => {
  let listener: NotificationsListener;

  const mockPrisma = {
    invoiceLog: {
      findUnique: jest.fn(),
    },
  };

  const mockNotificationsService = {
    notify: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsListener,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    listener = module.get<NotificationsListener>(NotificationsListener);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Listener handles 'invoice.paid' event -> payment_received notification
  // ──────────────────────────────────────────────────────────────────────────

  it('should create payment_received notification on invoice.paid event', async () => {
    mockPrisma.invoiceLog.findUnique.mockResolvedValue({
      id: 'il-1',
      airportId: 'ap-1',
      tenantId: 'tn-1',
      stripeInvoiceNumber: 'INV-001',
      amountTotal: 25000,
      currency: 'TRY',
      stripeHostedUrl: 'https://stripe.com/inv/123',
      tenant: {
        name: 'Aegean Duty Free',
        email: 'contact@aegeandutyfree.com',
      },
    });
    mockNotificationsService.notify.mockResolvedValue({});

    await listener.onInvoicePaid({ stripeInvoiceId: 'inv_123' });

    expect(mockNotificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        airportId: 'ap-1',
        tenantId: 'tn-1',
        type: NotificationType.payment_received,
        channel: NotificationChannel.both,
        emailTo: 'contact@aegeandutyfree.com',
      }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Listener handles 'invoice.payment_failed' -> payment_failed notification
  // ──────────────────────────────────────────────────────────────────────────

  it('should create payment_failed notification on invoice.payment_failed event', async () => {
    mockPrisma.invoiceLog.findUnique.mockResolvedValue({
      id: 'il-2',
      airportId: 'ap-1',
      tenantId: 'tn-1',
      stripeInvoiceNumber: 'INV-002',
      amountTotal: 30000,
      currency: 'TRY',
      stripeHostedUrl: 'https://stripe.com/inv/456',
      tenant: {
        name: 'Sky Cafe',
        email: 'info@skycafe.com',
      },
    });
    mockNotificationsService.notify.mockResolvedValue({});

    await listener.onInvoicePaymentFailed({ stripeInvoiceId: 'inv_456' });

    expect(mockNotificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        airportId: 'ap-1',
        tenantId: 'tn-1',
        type: NotificationType.payment_failed,
        channel: NotificationChannel.both,
        emailTo: 'info@skycafe.com',
      }),
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Listener skips when invoice not found
  // ──────────────────────────────────────────────────────────────────────────

  it('should skip notification when invoiceLog not found', async () => {
    mockPrisma.invoiceLog.findUnique.mockResolvedValue(null);

    await listener.onInvoicePaid({ stripeInvoiceId: 'inv_unknown' });

    expect(mockNotificationsService.notify).not.toHaveBeenCalled();
  });
});

// ============================================================================
// EmailService Tests
// ============================================================================

describe('EmailService', () => {
  let emailService: EmailService;

  const mockMailer = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Provide MailerService via its class token from @nestjs-modules/mailer
    const { MailerService } = await import('@nestjs-modules/mailer');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: MailerService, useValue: mockMailer },
      ],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
  });

  it('should render handlebars template and call sendMail', async () => {
    mockMailer.sendMail.mockResolvedValue({ messageId: 'msg-1' });

    await emailService.sendTemplate({
      to: 'tenant@example.com',
      subject: 'Fatura Olusturuldu - INV-001',
      template: 'invoice-created',
      context: { tenantName: 'Aegean', invoiceNumber: 'INV-001' },
    });

    expect(mockMailer.sendMail).toHaveBeenCalledWith({
      to: 'tenant@example.com',
      subject: 'Fatura Olusturuldu - INV-001',
      template: 'invoice-created',
      context: { tenantName: 'Aegean', invoiceNumber: 'INV-001' },
    });
  });
});
