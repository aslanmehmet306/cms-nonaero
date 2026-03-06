import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ContractStatus } from '@shared-types/enums';

export class TransitionContractDto {
  @ApiProperty({ enum: ContractStatus, description: 'Target contract status' })
  @IsEnum(ContractStatus)
  status!: ContractStatus;

  @ApiPropertyOptional({ description: 'Termination reason (required when transitioning to terminated)' })
  @IsOptional()
  @IsString()
  terminationReason?: string;
}
