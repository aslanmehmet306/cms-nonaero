import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EquipmentType, EquipmentCategory, EquipmentOwnership, DepreciationMethod } from '@shared-types/enums';

export class CreateEquipmentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  airportId!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiProperty({ example: 'POS Terminal Main Hall' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: EquipmentType })
  @IsEnum(EquipmentType)
  equipmentType!: EquipmentType;

  @ApiProperty({ enum: EquipmentCategory })
  @IsEnum(EquipmentCategory)
  category!: EquipmentCategory;

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

  @ApiPropertyOptional({ enum: EquipmentOwnership, default: 'airport' })
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

  @ApiPropertyOptional({ default: 'TRY' })
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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMetered?: boolean;

  @ApiPropertyOptional({ description: 'Unit of measurement (kWh, m3, units)' })
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
