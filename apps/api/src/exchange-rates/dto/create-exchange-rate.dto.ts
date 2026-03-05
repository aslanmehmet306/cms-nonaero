import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateExchangeRateDto {
  @ApiProperty({ description: 'Airport ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  airportId: string;

  @ApiProperty({ description: 'Source currency code', example: 'EUR' })
  @IsString()
  @IsNotEmpty()
  fromCurrency: string;

  @ApiProperty({ description: 'Target currency code', example: 'TRY' })
  @IsString()
  @IsNotEmpty()
  toCurrency: string;

  @ApiProperty({ description: 'Exchange rate value', example: 35.12 })
  @IsNumber()
  @IsPositive()
  rate: number;

  @ApiProperty({
    description: 'Effective date (ISO 8601)',
    example: '2026-01-15',
  })
  @IsString()
  @IsNotEmpty()
  effectiveDate: string;

  @ApiProperty({ description: 'Rate source (MANUAL, TCMB, ECB)', example: 'MANUAL' })
  @IsString()
  @IsNotEmpty()
  source: string;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'User ID who created the rate' })
  @IsString()
  @IsNotEmpty()
  createdBy: string;
}
