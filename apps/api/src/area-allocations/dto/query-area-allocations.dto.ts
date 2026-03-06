import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AllocationStatus } from '@shared-types/enums';
import { Type } from 'class-transformer';

export class QueryAreaAllocationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  airportId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ enum: AllocationStatus })
  @IsOptional()
  @IsEnum(AllocationStatus)
  status?: AllocationStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
