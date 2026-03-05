import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsEnum,
} from 'class-validator';

export enum RevenueSummaryGroupBy {
  tenant = 'tenant',
  chargeType = 'chargeType',
}

export class RevenueSummaryQueryDto {
  @ApiProperty({ description: 'Airport ID', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  airportId: string;

  @ApiProperty({ description: 'Period start (ISO 8601)', example: '2026-01-01' })
  @IsNotEmpty()
  @IsDateString()
  periodFrom: string;

  @ApiProperty({ description: 'Period end (ISO 8601)', example: '2026-12-31' })
  @IsNotEmpty()
  @IsDateString()
  periodTo: string;

  @ApiPropertyOptional({
    description: 'Group by dimension. Omit for both tenant and chargeType.',
    enum: RevenueSummaryGroupBy,
  })
  @IsOptional()
  @IsEnum(RevenueSummaryGroupBy)
  groupBy?: RevenueSummaryGroupBy;

  @ApiPropertyOptional({
    description: 'Convert amounts to this reporting currency using exchange rates. Omit for no conversion.',
  })
  @IsOptional()
  @IsString()
  reportingCurrency?: string;
}
