import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryExchangeRatesDto {
  @ApiProperty({ description: 'Airport ID' })
  @IsUUID()
  @IsNotEmpty()
  airportId: string;

  @ApiPropertyOptional({ description: 'Filter by source currency', example: 'EUR' })
  @IsOptional()
  @IsString()
  fromCurrency?: string;

  @ApiPropertyOptional({ description: 'Filter by target currency', example: 'TRY' })
  @IsOptional()
  @IsString()
  toCurrency?: string;

  @ApiPropertyOptional({
    description: 'Filter from date (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (ISO 8601)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number = 25;
}
