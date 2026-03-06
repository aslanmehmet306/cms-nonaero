import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsUUID } from 'class-validator';
import { DeclarationType } from '@shared-types/enums';

export class CreateDeclarationDto {
  @ApiProperty({ description: 'Airport ID (UUID)' })
  @IsUUID()
  airportId!: string;

  @ApiProperty({ description: 'Tenant ID (UUID)' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ description: 'Contract ID (UUID)' })
  @IsUUID()
  contractId!: string;

  @ApiProperty({ enum: DeclarationType, description: 'Type of declaration (revenue or meter_reading)' })
  @IsEnum(DeclarationType)
  declarationType!: DeclarationType;

  @ApiProperty({ description: 'Period start date (ISO date string, e.g. 2026-01-01)' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ description: 'Period end date (ISO date string, e.g. 2026-01-31)' })
  @IsDateString()
  periodEnd!: string;
}
