import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { AreaType, UnitClassification } from '@shared-types/enums';

/**
 * DTO for creating a new area in the airport hierarchy.
 */
export class CreateAreaDto {
  @ApiProperty({ description: 'Airport this area belongs to' })
  @IsUUID()
  airportId!: string;

  @ApiPropertyOptional({ description: 'Parent area ID (null for root-level terminals)' })
  @IsOptional()
  @IsUUID()
  parentAreaId?: string;

  @ApiProperty({ example: 'DOM-GF-A-001', description: 'Unique area code within the airport' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Duty Free Main', description: 'Human-readable area name' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: AreaType, example: AreaType.unit, description: 'Area type (terminal/floor/zone/unit)' })
  @IsEnum(AreaType)
  areaType!: AreaType;

  @ApiPropertyOptional({ example: 250.0, description: 'Area size in square metres' })
  @IsOptional()
  @IsNumber()
  areaM2?: number;

  @ApiPropertyOptional({ example: 3.5, description: 'Height in metres (mainly for units)' })
  @IsOptional()
  @IsNumber()
  heightM?: number;

  @ApiPropertyOptional({ enum: UnitClassification, example: UnitClassification.commercial, description: 'Unit classification (commercial, bank, rent_a_car, etc.)' })
  @IsOptional()
  @IsEnum(UnitClassification)
  unitClassification?: UnitClassification;

  @ApiPropertyOptional({ example: true, description: 'Whether the area is leasable to a tenant' })
  @IsOptional()
  @IsBoolean()
  isLeasable?: boolean;
}
