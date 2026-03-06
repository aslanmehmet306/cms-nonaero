import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpsertShareDto {
  @ApiProperty()
  @IsUUID()
  tenantId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiProperty({ example: '0.60000000', description: 'Share ratio (0-1), sum of all shares must equal 1' })
  @IsString()
  shareRatio!: string;

  @ApiPropertyOptional({ description: 'Fixed amount override' })
  @IsOptional()
  @IsString()
  fixedAmount?: string;
}
