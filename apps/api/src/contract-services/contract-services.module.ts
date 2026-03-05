import { Module } from '@nestjs/common';
import { ContractServicesService } from './contract-services.service';
import { ContractServicesController } from './contract-services.controller';

@Module({
  controllers: [ContractServicesController],
  providers: [ContractServicesService],
  exports: [ContractServicesService],
})
export class ContractServicesModule {}
