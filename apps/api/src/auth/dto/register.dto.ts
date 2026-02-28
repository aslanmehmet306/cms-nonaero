import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserRole } from '@shared-types/enums';

/**
 * DTO for user registration / creation.
 */
export class RegisterDto {
  @ApiProperty({ example: 'user@airport.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecureP@ss1', description: 'User password (min 8 chars)' })
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.airport_admin, description: 'User role' })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional({ description: 'Airport ID for airport-scoped users' })
  @IsUUID()
  @IsOptional()
  airportId?: string;

  @ApiPropertyOptional({ description: 'Tenant ID for tenant-scoped users' })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
}
