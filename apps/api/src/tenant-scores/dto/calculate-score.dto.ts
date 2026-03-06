import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class CalculateScoreDto {
  @ApiProperty()
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ example: '2025-01-01', description: 'Score period start date' })
  @IsDateString()
  scorePeriod!: string;
}
