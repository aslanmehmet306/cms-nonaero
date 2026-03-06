import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * DTO for updating a tenant group.
 * Immutable fields: airportId, code.
 */
export class UpdateTenantGroupDto {
  @ApiPropertyOptional({
    example: 'Updated Group Name',
    description: 'Display name for the tenant group',
  })
  @IsOptional()
  @IsString()
  name?: string;

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

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the group is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
