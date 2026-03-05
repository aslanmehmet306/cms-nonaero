import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType, NotificationChannel } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from './notifications.service';

/**
 * Event listener that wires billing/invoice events to notification creation.
 *
 * Listens for:
 *   - invoice.paid -> payment_received notification (both channels)
 *   - invoice.payment_failed -> payment_failed notification (both channels)
 *   - billing.completed -> billing_run_completed notification (in_app only)
 */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('invoice.paid')
  async onInvoicePaid(payload: { stripeInvoiceId: string }) {
    const invoiceLog = await this.prisma.invoiceLog.findUnique({
      where: { stripeInvoiceId: payload.stripeInvoiceId },
      include: { tenant: true },
    });

    if (!invoiceLog) {
      this.logger.warn(
        `InvoiceLog not found for stripeInvoiceId ${payload.stripeInvoiceId} — skipping notification`,
      );
      return;
    }

    await this.notificationsService.notify({
      airportId: invoiceLog.airportId,
      tenantId: invoiceLog.tenantId,
      type: NotificationType.payment_received,
      channel: NotificationChannel.both,
      title: `Odeme Alindi - ${invoiceLog.stripeInvoiceNumber}`,
      body: `${invoiceLog.tenant.name} icin ${invoiceLog.currency} ${invoiceLog.amountTotal} tutarinda odeme alindi.`,
      emailTo: invoiceLog.tenant.email ?? undefined,
      emailContext: {
        tenantName: invoiceLog.tenant.name,
        invoiceNumber: invoiceLog.stripeInvoiceNumber,
        amount: invoiceLog.amountTotal.toString(),
        currency: invoiceLog.currency,
        paidDate: new Date().toLocaleDateString('tr-TR'),
      },
    });
  }

  @OnEvent('invoice.payment_failed')
  async onInvoicePaymentFailed(payload: { stripeInvoiceId: string }) {
    const invoiceLog = await this.prisma.invoiceLog.findUnique({
      where: { stripeInvoiceId: payload.stripeInvoiceId },
      include: { tenant: true },
    });

    if (!invoiceLog) {
      this.logger.warn(
        `InvoiceLog not found for stripeInvoiceId ${payload.stripeInvoiceId} — skipping notification`,
      );
      return;
    }

    await this.notificationsService.notify({
      airportId: invoiceLog.airportId,
      tenantId: invoiceLog.tenantId,
      type: NotificationType.payment_failed,
      channel: NotificationChannel.both,
      title: `Odeme Basarisiz - ${invoiceLog.stripeInvoiceNumber}`,
      body: `${invoiceLog.tenant.name} icin odeme basarisiz oldu.`,
      emailTo: invoiceLog.tenant.email ?? undefined,
      emailContext: {
        tenantName: invoiceLog.tenant.name,
        invoiceNumber: invoiceLog.stripeInvoiceNumber,
        amount: invoiceLog.amountTotal.toString(),
        currency: invoiceLog.currency,
        hostedUrl: invoiceLog.stripeHostedUrl,
      },
    });
  }

  @OnEvent('billing.completed')
  async onBillingCompleted(payload: {
    billingRunId: string;
    airportId: string;
    totalInvoices: number;
  }) {
    await this.notificationsService.notify({
      airportId: payload.airportId,
      type: NotificationType.billing_run_completed,
      channel: NotificationChannel.in_app,
      title: 'Faturalama Tamamlandi',
      body: `Faturalama calismasi tamamlandi. ${payload.totalInvoices} fatura olusturuldu.`,
      metadata: { billingRunId: payload.billingRunId },
    });
  }
}
