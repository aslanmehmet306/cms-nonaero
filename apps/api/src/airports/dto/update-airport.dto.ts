import { PartialType } from '@nestjs/swagger';
import { CreateAirportDto } from './create-airport.dto';

/**
 * DTO for updating an airport. All fields from CreateAirportDto are optional.
 * isActive is already included in CreateAirportDto.
 */
export class UpdateAirportDto extends PartialType(CreateAirportDto) {}
