import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Only expression, variables, and name are updatable on draft formulas.
 * code, formulaType, and airportId are immutable after creation.
 */
export class UpdateFormulaDto {
  @ApiPropertyOptional({ description: 'Updated human-readable name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Updated math.js expression' })
  @IsOptional()
  @IsString()
  expression?: string;

  @ApiPropertyOptional({ description: 'Updated variable definitions' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
