import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { MeterReadingType, MeterReadingSource } from '@shared-types/enums';

export class CreateMeterReadingDto {
  @ApiProperty({ example: '2025-01-31' })
  @IsDateString()
  readingDate!: string;

  @ApiProperty({ example: '1500.5000' })
  @IsString()
  readingValue!: string;

  @ApiProperty({ example: 'kWh' })
  @IsString()
  unit!: string;

  @ApiProperty({ enum: MeterReadingType })
  @IsEnum(MeterReadingType)
  readingType!: MeterReadingType;

  @ApiPropertyOptional({ enum: MeterReadingSource, default: 'manual' })
  @IsOptional()
  @IsEnum(MeterReadingSource)
  source?: MeterReadingSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
