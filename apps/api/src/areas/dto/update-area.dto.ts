import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAreaDto } from './create-area.dto';

/**
 * DTO for updating an area.
 * airportId and parentAreaId are excluded — they cannot be changed after creation.
 */
export class UpdateAreaDto extends PartialType(
  OmitType(CreateAreaDto, ['airportId', 'parentAreaId'] as const),
) {
  @ApiPropertyOptional({ example: true, description: 'Whether the area is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
