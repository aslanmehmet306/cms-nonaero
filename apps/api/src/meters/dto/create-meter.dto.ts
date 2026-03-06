import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { MeterType } from '@shared-types/enums';

export class CreateMeterDto {
  @ApiProperty({ description: 'Area (unit) this meter belongs to' })
  @IsUUID()
  areaId!: string;

  @ApiProperty({ example: 'ELK-001', description: 'Meter serial number' })
  @IsString()
  serialNumber!: string;

  @ApiProperty({ enum: MeterType, example: MeterType.electricity, description: 'Meter type' })
  @IsEnum(MeterType)
  meterType!: MeterType;

  @ApiPropertyOptional({ example: 'Main panel - Ground floor', description: 'Physical location description' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the meter is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2024-01-15', description: 'Installation date' })
  @IsOptional()
  @IsDateString()
  installedAt?: string;
}
