import { Module } from '@nestjs/common';
import { ContractAreasService } from './contract-areas.service';
import { ContractAreasController } from './contract-areas.controller';

@Module({
  controllers: [ContractAreasController],
  providers: [ContractAreasService],
  exports: [ContractAreasService],
})
export class ContractAreasModule {}
