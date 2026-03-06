import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { OccupancyType } from '@shared-types/enums';

export class CreateAreaOccupancyDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  areaId!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiProperty({ enum: OccupancyType })
  @IsEnum(OccupancyType)
  occupancyType!: OccupancyType;

  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  occupiedFrom!: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  occupiedTo?: string;

  @ApiPropertyOptional({ example: '50.00', description: 'Occupied area in m2' })
  @IsOptional()
  @IsString()
  occupiedM2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
