import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ValidateMeterReadingDto {
  @ApiProperty({ description: 'ID of user who validated the reading' })
  @IsString()
  validatedBy!: string;
}
