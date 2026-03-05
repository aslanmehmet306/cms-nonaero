import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';

export class DashboardQueryDto {
  @ApiProperty({ description: 'Airport ID', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  airportId: string;

  @ApiPropertyOptional({ description: 'Period start (ISO 8601)', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @ApiPropertyOptional({ description: 'Period end (ISO 8601)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @ApiPropertyOptional({
    description: 'Convert totals to this reporting currency (e.g. TRY). Omit for no conversion.',
  })
  @IsOptional()
  @IsString()
  reportingCurrency?: string;
}
