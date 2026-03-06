import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for submitting a meter reading declaration.
 * The declaration is auto-submitted on creation (no draft state).
 * Consumption is automatically computed as: currentReading - previousReading.
 */
export class CreateMeterReadingDto {
  @ApiProperty({ description: 'Airport ID', format: 'uuid' })
  @IsUUID()
  airportId!: string;

  @ApiProperty({ description: 'Tenant ID', format: 'uuid' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ description: 'Contract ID', format: 'uuid' })
  @IsUUID()
  contractId!: string;

  @ApiProperty({ description: 'Period start date (ISO 8601)', example: '2026-01-01' })
  @IsISO8601()
  periodStart!: string;

  @ApiProperty({ description: 'Period end date (ISO 8601)', example: '2026-01-31' })
  @IsISO8601()
  periodEnd!: string;

  @ApiProperty({
    description: 'Current meter reading value (decimal string)',
    example: '1500.00',
  })
  @IsString()
  currentReading!: string;

  @ApiPropertyOptional({
    description: 'Meter type (electricity, water, gas, heating)',
    example: 'electricity',
  })
  @IsOptional()
  @IsString()
  meterType?: string;

  @ApiPropertyOptional({
    description: 'Unit of measurement (kWh, m3, etc.)',
    example: 'kWh',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Physical meter location description',
    example: 'Building A - Ground Floor',
  })
  @IsOptional()
  @IsString()
  location?: string;
}
