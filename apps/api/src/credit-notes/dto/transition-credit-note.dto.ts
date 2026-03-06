import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CreditNoteStatus } from '@shared-types/enums';

export class TransitionCreditNoteDto {
  @ApiProperty({ enum: CreditNoteStatus })
  @IsEnum(CreditNoteStatus)
  status!: CreditNoteStatus;

  @ApiPropertyOptional({ description: 'Approver ID (required for approved_cn transition)' })
  @IsOptional()
  @IsString()
  approvedBy?: string;
}
