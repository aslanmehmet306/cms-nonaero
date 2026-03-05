import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType, NotificationChannel } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from './email/email.service';

// ─────────────────────────────────────────────────────────────────────────────
// Severity mapping: NotificationType -> info | warning | error
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_MAP: Record<NotificationType, 'info' | 'warning' | 'error'> = {
  [NotificationType.cutoff_approaching]: 'warning',
  [NotificationType.declaration_missing]: 'warning',
  [NotificationType.invoice_created]: 'info',
  [NotificationType.payment_received]: 'info',
  [NotificationType.payment_failed]: 'error',
  [NotificationType.invoice_overdue]: 'error',
  [NotificationType.billing_run_completed]: 'info',
  [NotificationType.contract_expiring]: 'warning',
  [NotificationType.mag_shortfall]: 'warning',
};

// ─────────────────────────────────────────────────────────────────────────────
// Template mapping: NotificationType -> handlebars template name
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_MAP: Record<NotificationType, string | undefined> = {
  [NotificationType.cutoff_approaching]: 'cutoff-approaching',
  [NotificationType.declaration_missing]: 'declaration-missing',
  [NotificationType.invoice_created]: 'invoice-created',
  [NotificationType.payment_received]: 'payment-received',
  [NotificationType.payment_failed]: 'payment-failed',
  [NotificationType.invoice_overdue]: 'invoice-overdue',
  [NotificationType.contract_expiring]: 'contract-expiring',
  [NotificationType.billing_run_completed]: undefined, // no email template
  [NotificationType.mag_shortfall]: undefined, // no email template
};

// ─────────────────────────────────────────────────────────────────────────────
// Subject mapping: NotificationType -> default Turkish subject prefix
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECT_MAP: Record<NotificationType, string> = {
  [NotificationType.cutoff_approaching]: 'Beyan Teslim Tarihi Yaklastirma Hatirlatmasi',
  [NotificationType.declaration_missing]: 'Eksik Gelir Beyani Uyarisi',
  [NotificationType.invoice_created]: 'Fatura Olusturuldu',
  [NotificationType.payment_received]: 'Odeme Alindi',
  [NotificationType.payment_failed]: 'Odeme Basarisiz',
  [NotificationType.invoice_overdue]: 'Geciken Fatura Hatirlatmasi',
  [NotificationType.contract_expiring]: 'Sozlesme Sona Erme Bildirimi',
  [NotificationType.billing_run_completed]: 'Faturalama Tamamlandi',
  [NotificationType.mag_shortfall]: 'MAG Fark Bildirimi',
};

export interface NotifyParams {
  airportId: string;
  tenantId?: string;
  userId?: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  emailTo?: string;
  emailContext?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a notification and dispatch via the requested channel.
   *
   * 1. Create Notification record in DB
   * 2. If channel is email or both: send email via EmailService
   * 3. If channel is in_app or both: emit 'notification.created' event for SSE
   */
  async notify(params: NotifyParams) {
    // 1. Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        airportId: params.airportId,
        tenantId: params.tenantId,
        userId: params.userId,
        type: params.type,
        channel: params.channel,
        title: params.title,
        body: params.body,
        metadata: params.metadata as any,
      },
    });

    // 2. Email dispatch
    if (
      (params.channel === NotificationChannel.email ||
        params.channel === NotificationChannel.both) &&
      params.emailTo
    ) {
      const template = TEMPLATE_MAP[params.type];
      if (template) {
        try {
          await this.emailService.sendTemplate({
            to: params.emailTo,
            subject: SUBJECT_MAP[params.type],
            template,
            context: params.emailContext ?? {},
          });

          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { sentAt: new Date() },
          });
        } catch (err) {
          this.logger.error(
            `Email dispatch failed for notification ${notification.id}: ${(err as Error).message}`,
          );
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: { failedAt: new Date(), retryCount: { increment: 1 } },
          });
        }
      }
    }

    // 3. In-app push via SSE
    if (
      params.channel === NotificationChannel.in_app ||
      params.channel === NotificationChannel.both
    ) {
      const severity = this.getSeverity(params.type);
      this.eventEmitter.emit('notification.created', {
        notification,
        severity,
      });
    }

    return notification;
  }

  /**
   * Map NotificationType to severity level for notification bell display.
   */
  getSeverity(type: NotificationType): 'info' | 'warning' | 'error' {
    return SEVERITY_MAP[type] ?? 'info';
  }

  /**
   * Paginated list of notifications with optional filters.
   */
  async findAll(query: {
    tenantId?: string;
    userId?: string;
    isRead?: boolean;
    since?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.userId) where.userId = query.userId;
    if (query.isRead !== undefined) where.isRead = query.isRead;
    if (query.since) where.createdAt = { gte: new Date(query.since) };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
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
   * Mark a single notification as read.
   */
  async markAsRead(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all matching unread notifications as read.
   */
  async markAllAsRead(filter: { tenantId?: string; userId?: string }) {
    const where: Record<string, unknown> = { isRead: false };
    if (filter.tenantId) where.tenantId = filter.tenantId;
    if (filter.userId) where.userId = filter.userId;

    return this.prisma.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Count unread notifications for notification bell badge.
   */
  async getUnreadCount(filter: { tenantId?: string; userId?: string }) {
    const where: Record<string, unknown> = { isRead: false };
    if (filter.tenantId) where.tenantId = filter.tenantId;
    if (filter.userId) where.userId = filter.userId;

    return this.prisma.notification.count({ where });
  }
}
