import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * Only name, taxClass, and effectiveTo are updatable on draft services.
 * airportId, code, serviceType, formulaId are immutable after creation.
 */
export class UpdateServiceDto {
  @ApiPropertyOptional({ description: 'Updated human-readable name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Updated tax class code' })
  @IsOptional()
  @IsString()
  taxClass?: string;

  @ApiPropertyOptional({ description: 'Updated effective to date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
