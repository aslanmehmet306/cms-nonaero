import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * UploadDeclarationsDto — query params / body for the bulk upload endpoint.
 * The file itself is passed via multipart form-data as `file`.
 */
export class UploadDeclarationsDto {
  @ApiProperty({ description: 'Airport ID to associate uploaded declarations with' })
  @IsUUID()
  airportId!: string;
}
