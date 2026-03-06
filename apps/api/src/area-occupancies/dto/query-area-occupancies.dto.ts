import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OccupancyStatus, OccupancyType } from '@shared-types/enums';
import { Type } from 'class-transformer';

export class QueryAreaOccupanciesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ enum: OccupancyStatus })
  @IsOptional()
  @IsEnum(OccupancyStatus)
  status?: OccupancyStatus;

  @ApiPropertyOptional({ enum: OccupancyType })
  @IsOptional()
  @IsEnum(OccupancyType)
  occupancyType?: OccupancyType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
