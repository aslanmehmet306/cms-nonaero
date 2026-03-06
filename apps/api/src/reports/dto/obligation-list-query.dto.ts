import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ObligationStatus, ChargeType } from '@shared-types/enums';

export class ObligationListQueryDto {
  @ApiProperty({ description: 'Airport ID', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  airportId: string;

  @ApiPropertyOptional({ description: 'Filter by tenant ID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Period start filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'Period end filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ description: 'Filter by obligation status', enum: ObligationStatus })
  @IsOptional()
  @IsEnum(ObligationStatus)
  status?: ObligationStatus;

  @ApiPropertyOptional({ description: 'Filter by charge type', enum: ChargeType })
  @IsOptional()
  @IsEnum(ChargeType)
  chargeType?: ChargeType;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perPage?: number = 20;
}
