import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignAreaDto {
  @ApiProperty({ description: 'Area ID to assign', format: 'uuid' })
  @IsUUID()
  areaId!: string;

  @ApiProperty({ description: 'Effective start date for this area assignment', example: '2026-01-01' })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({ description: 'Effective end date for this area assignment', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
