import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EquipmentCategory, EquipmentOwnership, DepreciationMethod } from '@shared-types/enums';

export class UpdateEquipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  areaId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: EquipmentCategory })
  @IsOptional()
  @IsEnum(EquipmentCategory)
  category?: EquipmentCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ enum: EquipmentOwnership })
  @IsOptional()
  @IsEnum(EquipmentOwnership)
  ownership?: EquipmentOwnership;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acquisitionCost?: string;

  @ApiPropertyOptional({ enum: DepreciationMethod })
  @IsOptional()
  @IsEnum(DepreciationMethod)
  depreciationMethod?: DepreciationMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  usefulLifeMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residualValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  monthlyRentalRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rentalCurrency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  warrantyExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insurancePolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMetered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meterUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maintenanceIntervalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  energyRating?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
