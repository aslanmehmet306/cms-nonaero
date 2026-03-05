import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { InvoiceStatus } from '@shared-types/enums';
import { PrismaService } from '../database/prisma.service';

/**
 * WebhookService handles Stripe webhook event verification, deduplication, and dispatch.
 *
 * Flow:
 *   1. Verify signature with raw body
 *   2. Deduplicate via WebhookEventLog (skip if already processed)
 *   3. Dispatch to handler by event type
 *   4. Mark processed in WebhookEventLog
 *
 * Supported events:
 *   - invoice.paid -> InvoiceStatus.paid, set paidAt
 *   - invoice.payment_failed -> InvoiceStatus.past_due
 *   - invoice.voided -> InvoiceStatus.voided, set voidedAt
 *   - invoice.finalized -> InvoiceStatus.finalized
 *   - invoice.sent -> InvoiceStatus.sent
 */
@Injectable()
export class WebhookService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly eventEmitter: EventEmitter2,
  ) {
    this.stripe = new Stripe(config.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    });
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET') || '';
  }

  /**
   * Verify webhook signature and parse the event from raw body.
   * Uses raw body (Buffer) — not parsed JSON — for correct signature verification.
   */
  verifyAndParse(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }

  /**
   * Handle a verified Stripe event with deduplication.
   */
  async handleEvent(event: Stripe.Event): Promise<void> {
    // 1. Deduplication check
    const existing = await this.prisma.webhookEventLog.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existing?.processed) {
      this.logger.log(`Event ${event.id} already processed — skipping`);
      return;
    }

    // 2. Upsert webhook event log (idempotent)
    await this.prisma.webhookEventLog.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        payload: event.data as any,
      },
      update: {},
    });

    // 3. Dispatch by event type
    try {
      await this.dispatch(event);
    } catch (error) {
      await this.prisma.webhookEventLog.update({
        where: { stripeEventId: event.id },
        data: {
          errorMessage: (error as Error).message,
          retryCount: { increment: 1 },
        },
      });
      throw error;
    }

    // 4. Mark processed
    await this.prisma.webhookEventLog.update({
      where: { stripeEventId: event.id },
      data: { processed: true, processedAt: new Date() },
    });
  }

  private async dispatch(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const stripeInvoiceId = invoice.id;

    switch (event.type) {
      case 'invoice.paid':
        await this.updateInvoiceStatus(stripeInvoiceId, InvoiceStatus.paid, {
          paidAt: new Date(),
        });
        this.eventEmitter?.emit('invoice.paid', { stripeInvoiceId });
        break;

      case 'invoice.payment_failed':
        await this.updateInvoiceStatus(
          stripeInvoiceId,
          InvoiceStatus.past_due,
        );
        this.eventEmitter?.emit('invoice.payment_failed', {
          stripeInvoiceId,
        });
        break;

      case 'invoice.voided':
        await this.updateInvoiceStatus(stripeInvoiceId, InvoiceStatus.voided, {
          voidedAt: new Date(),
        });
        break;

      case 'invoice.finalized':
        await this.updateInvoiceStatus(
          stripeInvoiceId,
          InvoiceStatus.finalized,
        );
        break;

      case 'invoice.sent':
        await this.updateInvoiceStatus(stripeInvoiceId, InvoiceStatus.sent);
        break;

      default:
        this.logger.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * Update InvoiceLog status from a webhook event.
   * Handles out-of-order events gracefully: if invoice not yet in system, log and skip.
   */
  private async updateInvoiceStatus(
    stripeInvoiceId: string,
    status: InvoiceStatus,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    const invoiceLog = await this.prisma.invoiceLog.findUnique({
      where: { stripeInvoiceId },
    });

    if (!invoiceLog) {
      this.logger.warn(
        `InvoiceLog for Stripe invoice ${stripeInvoiceId} not found — event may be out of order`,
      );
      return;
    }

    await this.prisma.invoiceLog.update({
      where: { stripeInvoiceId },
      data: { status, ...extra },
    });

    this.logger.log(
      `InvoiceLog ${invoiceLog.id} updated to ${status} (Stripe: ${stripeInvoiceId})`,
    );
  }
}
