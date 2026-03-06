import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RiskCategory } from '@shared-types/enums';
import { Type } from 'class-transformer';

export class QueryTenantScoresDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ enum: RiskCategory })
  @IsOptional()
  @IsEnum(RiskCategory)
  riskCategory?: RiskCategory;

  @ApiPropertyOptional({ description: 'Filter by score period (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  scorePeriod?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
