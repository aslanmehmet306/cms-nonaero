import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { BillingFrequency, GuaranteeType } from '@shared-types/enums';

export class CreateContractDto {
  @ApiProperty({ description: 'Airport ID (UUID)' })
  @IsUUID()
  airportId!: string;

  @ApiProperty({ description: 'Tenant ID (UUID)' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ description: 'Contract effective start date (ISO date string)' })
  @IsDateString()
  effectiveFrom!: string;

  @ApiProperty({ description: 'Contract effective end date (ISO date string)' })
  @IsDateString()
  effectiveTo!: string;

  @ApiPropertyOptional({ description: 'Annual minimum activity guarantee amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualMag?: number;

  @ApiPropertyOptional({ description: 'MAG currency code (default: TRY)', default: 'TRY' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  magCurrency?: string;

  @ApiPropertyOptional({ enum: BillingFrequency, description: 'Billing frequency (default: monthly)' })
  @IsOptional()
  @IsEnum(BillingFrequency)
  billingFrequency?: BillingFrequency;

  @ApiPropertyOptional({ description: 'Name of the responsible owner/contact' })
  @IsOptional()
  @IsString()
  responsibleOwner?: string;

  @ApiPropertyOptional({ description: 'Escalation rule as JSON object' })
  @IsOptional()
  escalationRule?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Deposit amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ enum: GuaranteeType, description: 'Type of financial guarantee' })
  @IsOptional()
  @IsEnum(GuaranteeType)
  guaranteeType?: GuaranteeType;

  @ApiPropertyOptional({ description: 'Guarantee expiry date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  guaranteeExpiry?: string;

  @ApiPropertyOptional({ description: 'Signed at date/time (ISO date string)' })
  @IsOptional()
  @IsDateString()
  signedAt?: string;
}
