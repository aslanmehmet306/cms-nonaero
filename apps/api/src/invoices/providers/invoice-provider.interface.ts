/**
 * Provider-agnostic invoice interface.
 *
 * Active implementations:
 *   - StripeInvoiceProvider (default)
 *   - ErpInvoiceProvider (stub — future ERP integration)
 *
 * The injection token is used in InvoicesModule to swap implementations.
 */
export const INVOICE_PROVIDER = 'INVOICE_PROVIDER';

export interface CreateInvoiceParams {
  /** Stripe customer ID from tenant.stripeCustomerId */
  customerId: string;
  /** Currency code: TRY, EUR, USD — lowercased before sending to Stripe */
  currency: string;
  /** Invoice due date */
  dueDate: Date;
  /** Arbitrary metadata stored on the Stripe invoice */
  metadata: Record<string, string>;
  /** Idempotency key pattern: {billingRunId}_{chargeType}_{tenantId} */
  idempotencyKey: string;
}

export interface InvoiceLineItem {
  /** Line item description */
  description: string;
  /** Amount in smallest currency unit (kurus for TRY, cents for EUR/USD) */
  amount: number;
  /** Currency code (lowercase) */
  currency: string;
  /** Arbitrary metadata for the line item */
  metadata: Record<string, string>;
}

export interface ExternalInvoice {
  /** External provider invoice ID (e.g. Stripe invoice ID) */
  externalId: string;
  /** Invoice number (assigned after finalization) */
  invoiceNumber?: string;
  /** Hosted URL for the invoice (customer-facing) */
  hostedUrl?: string;
  /** PDF download URL */
  pdfUrl?: string;
  /** Invoice status from the provider */
  status: string;
}

export interface InvoiceProvider {
  createDraftInvoice(params: CreateInvoiceParams): Promise<ExternalInvoice>;
  addLineItems(
    invoiceId: string,
    items: InvoiceLineItem[],
    customerId: string,
    idempotencyKey: string,
  ): Promise<void>;
  finalizeInvoice(invoiceId: string): Promise<ExternalInvoice>;
  voidInvoice(invoiceId: string): Promise<void>;
}
