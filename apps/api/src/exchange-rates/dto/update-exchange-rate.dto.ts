import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateExchangeRateDto {
  @ApiPropertyOptional({ description: 'Updated exchange rate value', example: 36.50 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  rate?: number;

  @ApiPropertyOptional({ description: 'Updated notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Updated source', example: 'TCMB' })
  @IsOptional()
  @IsString()
  source?: string;
}
