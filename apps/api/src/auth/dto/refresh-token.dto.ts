import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for token refresh (POST /api/v1/auth/admin/refresh, /api/v1/auth/tenant/refresh).
 */
export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token from the last login or refresh' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
