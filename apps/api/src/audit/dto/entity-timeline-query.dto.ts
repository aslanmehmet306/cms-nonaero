import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class EntityTimelineQueryDto {
  @ApiProperty({ description: 'Entity type (e.g. Obligation, Contract, Tenant)' })
  @IsNotEmpty()
  @IsString()
  entityType: string;

  @ApiProperty({ description: 'Entity UUID' })
  @IsUUID()
  entityId: string;
}
