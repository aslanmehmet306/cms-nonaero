import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

/**
 * DTO for admin login (POST /api/v1/auth/admin/login).
 */
export class LoginDto {
  @ApiProperty({ example: 'admin@airport.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecureP@ss1', description: 'User password (min 8 chars)' })
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
