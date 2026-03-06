import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class DryRunFormulaDto {
  @ApiPropertyOptional({
    description: 'Variable overrides for evaluation (merged with predefined sample data)',
    example: { area_m2: 200, rate_per_m2: 75 },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
