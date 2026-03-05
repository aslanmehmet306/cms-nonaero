import { Module } from '@nestjs/common';
import { BillingPoliciesService } from './billing-policies.service';
import { BillingPoliciesController } from './billing-policies.controller';

@Module({
  controllers: [BillingPoliciesController],
  providers: [BillingPoliciesService],
  exports: [BillingPoliciesService],
})
export class BillingPoliciesModule {}
