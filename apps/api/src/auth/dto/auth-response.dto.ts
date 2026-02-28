import { ApiProperty } from '@nestjs/swagger';

class AuthUser {
  @ApiProperty({ description: 'User ID' })
  sub!: string;

  @ApiProperty({ description: 'User email' })
  email!: string;

  @ApiProperty({ description: 'User role' })
  role!: string;

  @ApiProperty({ description: 'Airport ID', required: false })
  airportId?: string;

  @ApiProperty({ description: 'Tenant ID', required: false })
  tenantId?: string;
}

/**
 * Response DTO for authentication endpoints.
 */
export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  access_token!: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refresh_token!: string;

  @ApiProperty({ description: 'Access token expiration in seconds' })
  expires_in!: number;

  @ApiProperty({ description: 'Authenticated user details', type: AuthUser })
  user!: AuthUser;
}
