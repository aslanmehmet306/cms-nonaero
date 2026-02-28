import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

/**
 * DTO for tenant login (POST /api/v1/auth/tenant/login).
 * Requires email, password, and tenant code.
 */
export class TenantLoginDto {
  @ApiProperty({ example: 'tenant@example.com', description: 'Tenant user email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecureP@ss1', description: 'Tenant user password (min 8 chars)' })
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'TNT-001', description: 'Tenant code identifying the tenant' })
  @IsNotEmpty()
  tenantCode!: string;
}
