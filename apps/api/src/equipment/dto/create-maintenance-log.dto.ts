import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { MaintenanceType } from '@shared-types/enums';

export class CreateMaintenanceLogDto {
  @ApiProperty({ enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  maintenanceType!: MaintenanceType;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsString()
  performedBy!: string;

  @ApiProperty()
  @IsDateString()
  performedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cost?: string;

  @ApiPropertyOptional({ default: 'TRY' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextScheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
