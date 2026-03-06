import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class AgingReportQueryDto {
  @ApiProperty({ description: 'Airport ID', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  airportId: string;

  @ApiPropertyOptional({
    description: 'As-of date for aging calculation (ISO 8601). Defaults to today.',
    example: '2026-03-15',
  })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
