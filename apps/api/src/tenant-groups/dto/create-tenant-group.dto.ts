import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * DTO for creating a new tenant group.
 * Code is auto-generated (GRP-001, GRP-002, ...) — do not include in request.
 */
export class CreateTenantGroupDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of the airport this group belongs to',
  })
  @IsUUID()
  airportId!: string;

  @ApiProperty({
    example: 'Retail Holdings Group',
    description: 'Display name for the tenant group',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Parent group ID for hierarchical grouping',
  })
  @IsOptional()
  @IsUUID()
  parentGroupId?: string;

  @ApiPropertyOptional({
    example: 'TR-9876543210',
    description: 'Group-level tax identification number',
  })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({
    example: 'group@holdingco.com',
    description: 'Group contact email',
  })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}
