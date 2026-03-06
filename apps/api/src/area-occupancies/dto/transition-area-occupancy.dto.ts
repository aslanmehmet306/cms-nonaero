import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OccupancyStatus } from '@shared-types/enums';

export class TransitionAreaOccupancyDto {
  @ApiProperty({ enum: OccupancyStatus })
  @IsEnum(OccupancyStatus)
  status!: OccupancyStatus;
}
