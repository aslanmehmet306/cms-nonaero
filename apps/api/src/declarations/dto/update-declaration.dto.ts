import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DeclarationType } from '@shared-types/enums';

/**
 * UpdateDeclarationDto — mutable fields only.
 * Excludes: id, status, frozenToken, frozenAt, submittedAt (server-managed)
 */
export class UpdateDeclarationDto {
  @ApiPropertyOptional({ description: 'Airport ID (UUID)' })
  @IsOptional()
  @IsUUID()
  airportId?: string;

  @ApiPropertyOptional({ description: 'Tenant ID (UUID)' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Contract ID (UUID)' })
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional({ enum: DeclarationType, description: 'Declaration type' })
  @IsOptional()
  @IsEnum(DeclarationType)
  declarationType?: DeclarationType;

  @ApiPropertyOptional({ description: 'Period start date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'Period end date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
