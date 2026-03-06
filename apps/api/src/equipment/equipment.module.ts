import { Module } from '@nestjs/common';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

/**
 * EquipmentModule — Equipment asset lifecycle management.
 *
 * Exports EquipmentService for use by ObligationsModule (equipment rental billing).
 * DatabaseModule is global, so no explicit import needed.
 */
@Module({
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
