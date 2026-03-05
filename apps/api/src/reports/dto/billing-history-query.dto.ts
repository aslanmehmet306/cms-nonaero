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
import { BillingRunStatus } from '@shared-types/enums';

export class BillingHistoryQueryDto {
  @ApiProperty({ description: 'Airport ID', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  airportId: string;

  @ApiPropertyOptional({ description: 'Period start filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @ApiPropertyOptional({ description: 'Period end filter (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @ApiPropertyOptional({ description: 'Filter by billing run status', enum: BillingRunStatus })
  @IsOptional()
  @IsEnum(BillingRunStatus)
  status?: BillingRunStatus;

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
