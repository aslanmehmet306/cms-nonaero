import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AllocationMethod } from '@shared-types/enums';

export class CreateAreaAllocationDto {
  @ApiProperty()
  @IsUUID()
  airportId!: string;

  @ApiProperty()
  @IsUUID()
  areaId!: string;

  @ApiProperty({ enum: AllocationMethod })
  @IsEnum(AllocationMethod)
  allocationMethod!: AllocationMethod;

  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  periodStart!: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ example: '50000.00' })
  @IsOptional()
  @IsString()
  totalCost?: string;

  @ApiPropertyOptional({ default: 'TRY' })
  @IsOptional()
  @IsString()
  currency?: string;
}
