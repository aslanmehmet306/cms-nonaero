import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * AmendContractDto — pricing-only fields per design decision.
 * Area and service add/remove is NOT allowed through amendments.
 * effectiveFrom must be the 1st of a future month (validated in service).
 */
export class AmendContractDto {
  @ApiProperty({
    description: 'Amendment effective start date (must be 1st of a future month, ISO date string)',
    example: '2026-04-01',
  })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({ description: 'Updated annual MAG amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualMag?: number;

  @ApiPropertyOptional({ description: 'Updated MAG currency code' })
  @IsOptional()
  @IsString()
  magCurrency?: string;

  @ApiPropertyOptional({ description: 'Custom pricing parameters (JSON object)' })
  @IsOptional()
  customParameters?: Record<string, unknown>;
}
