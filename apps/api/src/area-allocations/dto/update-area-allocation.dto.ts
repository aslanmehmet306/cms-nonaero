import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AllocationMethod } from '@shared-types/enums';

export class UpdateAreaAllocationDto {
  @ApiPropertyOptional({ enum: AllocationMethod })
  @IsOptional()
  @IsEnum(AllocationMethod)
  allocationMethod?: AllocationMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  totalCost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;
}
