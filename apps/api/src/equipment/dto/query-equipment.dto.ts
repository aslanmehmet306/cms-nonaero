import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EquipmentType, EquipmentStatus, EquipmentCategory } from '@shared-types/enums';
import { Type } from 'class-transformer';

export class QueryEquipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  airportId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ enum: EquipmentType })
  @IsOptional()
  @IsEnum(EquipmentType)
  equipmentType?: EquipmentType;

  @ApiPropertyOptional({ enum: EquipmentStatus })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @ApiPropertyOptional({ enum: EquipmentCategory })
  @IsOptional()
  @IsEnum(EquipmentCategory)
  category?: EquipmentCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  isMetered?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
