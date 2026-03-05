import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingFrequency } from '@shared-types/enums';

export class AssignServiceDto {
  @ApiProperty({ description: 'Service definition ID to assign', format: 'uuid' })
  @IsUUID()
  serviceDefinitionId!: string;

  @ApiPropertyOptional({
    description: 'Override formula ID for contract-specific pricing',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  overrideFormulaId?: string;

  @ApiPropertyOptional({ description: 'Override currency (e.g. EUR, USD, TRY)', example: 'EUR' })
  @IsOptional()
  @IsString()
  overrideCurrency?: string;

  @ApiPropertyOptional({
    description: 'Override billing frequency',
    enum: BillingFrequency,
  })
  @IsOptional()
  @IsEnum(BillingFrequency)
  overrideBillingFreq?: BillingFrequency;

  @ApiPropertyOptional({ description: 'Custom formula parameters (JSON object)' })
  @IsOptional()
  customParameters?: Record<string, unknown>;
}
