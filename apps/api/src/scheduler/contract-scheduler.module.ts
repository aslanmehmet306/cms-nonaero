import { Module } from '@nestjs/common';
import { ContractSchedulerService } from './contract-scheduler.service';

@Module({
  providers: [ContractSchedulerService],
})
export class ContractSchedulerModule {}
