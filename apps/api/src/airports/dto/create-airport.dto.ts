import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

/**
 * DTO for creating a new airport.
 */
export class CreateAirportDto {
  @ApiProperty({ example: 'ADB', description: 'IATA airport code (2–10 chars)' })
  @IsString()
  @Length(2, 10)
  code!: string;

  @ApiProperty({ example: 'Izmir Adnan Menderes International Airport', description: 'Full airport name' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'TR', description: 'ISO 3166-1 alpha-2/3 country code (2–3 chars)' })
  @IsString()
  @Length(2, 3)
  countryCode!: string;

  @ApiPropertyOptional({ example: 'TRY', description: 'Default billing currency (ISO 4217)' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({ example: 'Europe/Istanbul', description: 'IANA timezone identifier' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the airport is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
