import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AllocationStatus } from '@shared-types/enums';

export class TransitionAreaAllocationDto {
  @ApiProperty({ enum: AllocationStatus })
  @IsEnum(AllocationStatus)
  status!: AllocationStatus;
}
