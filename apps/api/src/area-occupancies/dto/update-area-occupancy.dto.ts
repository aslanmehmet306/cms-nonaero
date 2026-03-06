import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { OccupancyType } from '@shared-types/enums';

export class UpdateAreaOccupancyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional({ enum: OccupancyType })
  @IsOptional()
  @IsEnum(OccupancyType)
  occupancyType?: OccupancyType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occupiedFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occupiedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occupiedM2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
