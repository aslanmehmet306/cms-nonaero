import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoicesController } from './invoices.controller';
import { WebhookController } from './webhook.controller';
import { InvoicesService } from './invoices.service';
import { WebhookService } from './webhook.service';
import { InvoiceGenerationProcessor } from './invoice-generation.processor';
import { StripeInvoiceProvider } from './providers/stripe-invoice.provider';
import { INVOICE_PROVIDER } from './providers/invoice-provider.interface';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'invoice-generation' }),
    BillingModule,
  ],
  controllers: [InvoicesController, WebhookController],
  providers: [
    InvoicesService,
    WebhookService,
    InvoiceGenerationProcessor,
    {
      provide: INVOICE_PROVIDER,
      useClass: StripeInvoiceProvider,
    },
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
