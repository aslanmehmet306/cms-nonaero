import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { BillingFrequency, ServiceType } from '@shared-types/enums';

export class CreateServiceDto {
  @ApiProperty({ description: 'Airport ID (UUID)' })
  @IsUUID()
  airportId: string;

  @ApiProperty({ description: 'Unique service code (e.g. FIXED-RENT)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Human-readable service name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ServiceType, description: 'Service type' })
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiProperty({ description: 'Formula ID (UUID) — must reference existing formula' })
  @IsUUID()
  formulaId: string;

  @ApiPropertyOptional({ description: 'Default currency code (default: TRY)', default: 'TRY' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiProperty({ enum: BillingFrequency, description: 'Default billing frequency' })
  @IsEnum(BillingFrequency)
  defaultBillingFreq: BillingFrequency;

  @ApiPropertyOptional({ description: 'Tax class code (optional)' })
  @IsOptional()
  @IsString()
  taxClass?: string;

  @ApiProperty({ description: 'Effective from date (ISO date string)' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ description: 'Effective to date (ISO date string, optional)' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
