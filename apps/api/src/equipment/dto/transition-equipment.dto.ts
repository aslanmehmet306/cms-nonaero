import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EquipmentStatus } from '@shared-types/enums';

export class TransitionEquipmentDto {
  @ApiProperty({ enum: EquipmentStatus, description: 'Target status to transition to' })
  @IsEnum(EquipmentStatus)
  status!: EquipmentStatus;
}
