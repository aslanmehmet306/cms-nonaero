import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  InvoiceProvider,
  CreateInvoiceParams,
  InvoiceLineItem,
  ExternalInvoice,
} from './invoice-provider.interface';

/**
 * ERP invoice provider stub.
 *
 * Future integration point for ERP systems (e.g. SAP, Oracle).
 * All methods throw NotImplementedException until ERP integration is built.
 * Registered in InvoicesModule as an alternative to StripeInvoiceProvider (R9.2).
 */
@Injectable()
export class ErpInvoiceProvider implements InvoiceProvider {
  async createDraftInvoice(_params: CreateInvoiceParams): Promise<ExternalInvoice> {
    throw new NotImplementedException('ERP invoice provider not yet implemented');
  }

  async addLineItems(
    _invoiceId: string,
    _items: InvoiceLineItem[],
    _customerId: string,
    _idempotencyKey: string,
  ): Promise<void> {
    throw new NotImplementedException('ERP invoice provider not yet implemented');
  }

  async finalizeInvoice(_invoiceId: string): Promise<ExternalInvoice> {
    throw new NotImplementedException('ERP invoice provider not yet implemented');
  }

  async voidInvoice(_invoiceId: string): Promise<void> {
    throw new NotImplementedException('ERP invoice provider not yet implemented');
  }
}
