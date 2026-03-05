import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * DTO for creating a new tenant.
 * Code is auto-generated (TNT-001, TNT-002, ...) — do not include in request.
 * stripeCustomerId is auto-created — do not include in request.
 */
export class CreateTenantDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of the airport this tenant belongs to',
  })
  @IsUUID()
  airportId!: string;

  @ApiProperty({
    example: 'Acme Retail Ltd.',
    description: 'Full legal name of the tenant',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: 'TR-1234567890',
    description: 'Tax identification number (required for invoicing)',
  })
  @IsString()
  @IsNotEmpty()
  taxId!: string;

  @ApiProperty({
    example: 'billing@acme.com',
    description: 'Primary billing contact email',
  })
  @IsEmail()
  email!: string;

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
