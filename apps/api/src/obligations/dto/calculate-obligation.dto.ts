import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for the POST /obligations/:id/calculate endpoint.
 * Optionally links the calculation to a declaration (for audit trail).
 */
export class CalculateObligationDto {
  @ApiPropertyOptional({
    description: 'Declaration ID to link as the source of this obligation calculation',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  declarationId?: string;
}
