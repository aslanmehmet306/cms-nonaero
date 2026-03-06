import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateMeterDto } from './create-meter.dto';

/**
 * DTO for updating a meter.
 * areaId is immutable after creation.
 */
export class UpdateMeterDto extends PartialType(
  OmitType(CreateMeterDto, ['areaId'] as const),
) {}
