import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  InvoiceProvider,
  CreateInvoiceParams,
  InvoiceLineItem,
  ExternalInvoice,
} from './invoice-provider.interface';

/**
 * Stripe implementation of InvoiceProvider.
 *
 * 3-step flow: create draft -> add line items -> finalize.
 * All Stripe API calls include idempotency keys to prevent duplicate charges.
 * Amounts must be in smallest currency unit (kurus for TRY, cents for EUR/USD).
 */
@Injectable()
export class StripeInvoiceProvider implements InvoiceProvider {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeInvoiceProvider.name);

  constructor(private readonly config: ConfigService) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(stripeKey || '', {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    });
  }

  async createDraftInvoice(params: CreateInvoiceParams): Promise<ExternalInvoice> {
    this.logger.log(
      `Creating draft invoice for customer ${params.customerId} (key: ${params.idempotencyKey})`,
    );

    const invoice = await this.stripe.invoices.create(
      {
        customer: params.customerId,
        currency: params.currency.toLowerCase(),
        collection_method: 'send_invoice',
        days_until_due: 30,
        metadata: params.metadata,
      },
      { idempotencyKey: `${params.idempotencyKey}_create` },
    );

    return {
      externalId: invoice.id,
      invoiceNumber: invoice.number ?? undefined,
      hostedUrl: invoice.hosted_invoice_url ?? undefined,
      pdfUrl: invoice.invoice_pdf ?? undefined,
      status: invoice.status ?? 'draft',
    };
  }

  async addLineItems(
    invoiceId: string,
    items: InvoiceLineItem[],
    customerId: string,
    idempotencyKey: string,
  ): Promise<void> {
    for (let i = 0; i < items.length; i++) {
      await this.stripe.invoiceItems.create(
        {
          customer: customerId,
          invoice: invoiceId,
          amount: Math.round(items[i].amount), // Must be integer (smallest currency unit)
          currency: items[i].currency.toLowerCase(),
          description: items[i].description,
          metadata: items[i].metadata,
        },
        { idempotencyKey: `${idempotencyKey}_item_${i}` },
      );
    }

    this.logger.log(
      `Added ${items.length} line items to invoice ${invoiceId}`,
    );
  }

  async finalizeInvoice(invoiceId: string): Promise<ExternalInvoice> {
    const finalized = await this.stripe.invoices.finalizeInvoice(invoiceId);

    this.logger.log(
      `Finalized invoice ${invoiceId} -> ${finalized.number ?? 'no number'}`,
    );

    return {
      externalId: finalized.id,
      invoiceNumber: finalized.number ?? undefined,
      hostedUrl: finalized.hosted_invoice_url ?? undefined,
      pdfUrl: finalized.invoice_pdf ?? undefined,
      status: finalized.status ?? 'open',
    };
  }

  async voidInvoice(invoiceId: string): Promise<void> {
    await this.stripe.invoices.voidInvoice(invoiceId);
    this.logger.log(`Voided invoice ${invoiceId}`);
  }
}
