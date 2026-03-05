import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * DTO for updating a tenant's mutable fields.
 * Immutable fields: airportId, code, taxId (business identifier, not updatable post-creation).
 * stripeCustomerId is managed internally — not updatable via API.
 */
export class UpdateTenantDto {
  @ApiPropertyOptional({
    example: 'Acme Retail Ltd.',
    description: 'Full legal name of the tenant',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'billing@acme.com',
    description: 'Primary billing contact email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+90 555 123 4567',
    description: 'Contact phone number',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: 'Terminal 1, Gate A-5, Izmir Airport',
    description: 'Physical address of the tenant',
  })
  @IsOptional()
  @IsString()
  address?: string;
}
