import { Module } from '@nestjs/common';
import { ContractEquipmentController } from './contract-equipment.controller';
import { ContractEquipmentService } from './contract-equipment.service';

@Module({
  controllers: [ContractEquipmentController],
  providers: [ContractEquipmentService],
  exports: [ContractEquipmentService],
})
export class ContractEquipmentModule {}
