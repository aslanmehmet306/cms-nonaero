import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BillingController } from './billing.controller';
import { BillingSseController } from './sse/billing-sse.controller';
import { BillingService } from './billing.service';
import { BillingRunProcessor } from './billing-run.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'billing-run' }),
    BullModule.registerQueue({ name: 'invoice-generation' }),
    BullBoardModule.forFeature({ name: 'billing-run', adapter: BullMQAdapter }),
    BullBoardModule.forFeature({ name: 'invoice-generation', adapter: BullMQAdapter }),
  ],
  controllers: [BillingController, BillingSseController],
  providers: [BillingService, BillingRunProcessor],
  exports: [BillingService],
})
export class BillingModule {}
