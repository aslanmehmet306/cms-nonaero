import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDeclarationLineDto {
  @ApiProperty({ description: 'Gross amount (decimal string, e.g. "10000.00")' })
  @IsDecimal()
  grossAmount!: string;

  @ApiPropertyOptional({ description: 'Deductions amount (decimal string, defaults to "0")', default: '0' })
  @IsOptional()
  @IsDecimal()
  deductions?: string;

  @ApiPropertyOptional({ description: 'Revenue category (e.g. Food & Beverage)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @ApiPropertyOptional({ description: 'Unit of measure (e.g. m2, kWh)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unitOfMeasure?: string;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
